import { GoogleGenAI } from '@google/genai';
import { createHash } from 'node:crypto';
import { sqliteTranslationCacheRepo } from '@/lib/db/sqlite';

export type CjkField = 'identityCore' | 'description' | 'mustKeepFeature' | 'guideline';

export interface TranslationRequest {
  id: string;
  field: CjkField;
  text: string;
}

const FIELD_STYLE_GUIDE: Record<CjkField, string> = {
  identityCore: 'one concise English sentence capturing identity anchors (face, body, outfit, materials). Preserve proper nouns.',
  description: 'one concise English sentence. Preserve proper nouns and brand names.',
  mustKeepFeature: 'a single short English tag phrase; no leading articles, no trailing punctuation.',
  guideline: 'one concise English clause.',
};

export function isMostlyCjk(text: string): boolean {
  if (!text) return false;
  const cjkOrKana = text.replace(
    /[^\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g,
    ''
  );
  return cjkOrKana.length > text.length * 0.3;
}

function hashText(text: string): string {
  return createHash('sha256').update(text.trim()).digest('hex');
}

export async function translateCjkRequests(
  requests: TranslationRequest[],
  apiKey: string,
  model?: string
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uncached: TranslationRequest[] = [];

  for (const req of requests) {
    const trimmed = req.text?.trim() || '';
    if (!trimmed) {
      results.set(req.id, '');
      continue;
    }
    if (!isMostlyCjk(trimmed)) {
      results.set(req.id, trimmed);
      continue;
    }
    const cached = sqliteTranslationCacheRepo.get(hashText(trimmed));
    if (cached) {
      results.set(req.id, cached);
      continue;
    }
    uncached.push({ ...req, text: trimmed });
  }

  if (uncached.length === 0) return results;

  const ai = new GoogleGenAI({ apiKey });
  const modelName = model
    || process.env.GEMINI_TRANSLATION_MODEL
    || 'gemini-3.1-flash-lite';

  const systemPrompt = `You translate Chinese/Japanese/Korean reference text into concise English for image-generation prompts.
Rules:
- Preserve proper nouns, character names and brand names exactly.
- Do not paraphrase, pad, or add explanations. Output tags/clauses directly.
- Match the style guide per field:
  - identityCore: ${FIELD_STYLE_GUIDE.identityCore}
  - description: ${FIELD_STYLE_GUIDE.description}
  - mustKeepFeature: ${FIELD_STYLE_GUIDE.mustKeepFeature}
  - guideline: ${FIELD_STYLE_GUIDE.guideline}
Return strict JSON: {"translations":[{"id":"<id>","english":"<text>"}]}. No markdown, no commentary.`;

  const payload = uncached.map((req) => ({
    id: req.id,
    field: req.field,
    source: req.text,
  }));

  let parsed: { translations?: Array<{ id: string; english: string }> } = {};
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      config: { responseMimeType: 'application/json' },
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nInput:\n${JSON.stringify(payload)}` }],
        },
      ],
    });
    parsed = JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('[translateCjkRequests] Gemini translation failed:', error);
  }

  const byId = new Map<string, string>();
  for (const item of parsed.translations || []) {
    if (item && typeof item.id === 'string' && typeof item.english === 'string') {
      const english = item.english.trim();
      if (english) byId.set(item.id, english);
    }
  }

  for (const req of uncached) {
    const english = byId.get(req.id);
    if (english) {
      sqliteTranslationCacheRepo.set(hashText(req.text), req.text, english, req.field);
      results.set(req.id, english);
    } else {
      results.set(req.id, req.text);
    }
  }

  return results;
}
