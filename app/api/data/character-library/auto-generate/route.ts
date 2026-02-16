import { NextRequest, NextResponse } from 'next/server';
import { generateImage, checkQueueStatus, getImageResult } from '@/lib/api/fal';
import { analyzeReferenceImage, generateCharacterProfile } from '@/lib/api/openrouter';
import { sqliteCharacterLibraryRepo } from '@/lib/db/sqlite';
import type { CharacterLibraryItem } from '@/lib/types/character-library';

export const runtime = 'nodejs';
export const maxDuration = 120;

type ViewAngle = 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';

interface StructuredReferenceAnalysis {
  description: string;
  mustKeep: string[];
  identityCore?: string;
  materialLighting?: string;
  styleTraits?: string;
  angleVisibility?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deriveEndpointFromResponseUrl(responseUrl?: string): string | null {
  if (!responseUrl) return null;
  try {
    const url = new URL(responseUrl);
    const path = url.pathname.replace(/^\/+/, '');
    const marker = '/requests/';
    const idx = path.indexOf(marker);
    if (idx <= 0) return null;
    const endpoint = path.slice(0, idx).trim();
    return endpoint || null;
  } catch {
    return null;
  }
}

async function fetchResultByResponseUrl(responseUrl: string, apiKey: string) {
  const headersList: Array<HeadersInit | undefined> = [
    undefined,
    { Authorization: `Key ${apiKey}` },
    { Authorization: `Bearer ${apiKey}` },
  ];

  for (const headers of headersList) {
    const response = await fetch(responseUrl, { headers, cache: 'no-store' });
    if (!response.ok) continue;
    return response.json() as Promise<{
      data?: { images?: Array<{ url: string }> };
      images?: Array<{ url: string }>;
    }>;
  }

  return null;
}

async function waitForImageUrl(requestId: string, endpoint: string, apiKey: string): Promise<string> {
  const maxTries = 60;
  const pollMs = 2000;

  for (let attempt = 0; attempt < maxTries; attempt += 1) {
    const status = await checkQueueStatus(requestId, endpoint, { apiKey });

    if (status.status === 'FAILED') {
      throw new Error(status.error || '圖片生成失敗');
    }

    if (status.status === 'COMPLETED') {
      try {
        const result = await getImageResult(requestId, endpoint, { apiKey });
        const url = result.images?.[0]?.url;
        if (url) return url;
      } catch {
        const fallbackEndpoint = deriveEndpointFromResponseUrl(status.response_url);
        if (fallbackEndpoint && fallbackEndpoint !== endpoint) {
          try {
            const result = await getImageResult(requestId, fallbackEndpoint, { apiKey });
            const url = result.images?.[0]?.url;
            if (url) return url;
          } catch {
            // continue to response_url fallback
          }
        }

        if (status.response_url) {
          const raw = await fetchResultByResponseUrl(status.response_url, apiKey);
          const url = raw?.data?.images?.[0]?.url || raw?.images?.[0]?.url;
          if (url) return url;
        }
      }

      throw new Error('圖片生成完成，但無法取得結果');
    }

    await sleep(pollMs);
  }

  throw new Error('圖片生成逾時，請稍後再試');
}

function sanitizeType(value: unknown): CharacterLibraryItem['type'] {
  const raw = typeof value === 'string' ? value : '';
  if (raw === 'product' || raw === 'environment' || raw === 'style') return raw;
  return 'character';
}

function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
    .filter((tag) => {
      if (!tag) return false;
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

function buildImagePrompt({
  name,
  type,
  prompt,
  styleHint,
}: {
  name: string;
  type: CharacterLibraryItem['type'];
  prompt: string;
  styleHint?: string;
}) {
  const typeText: Record<CharacterLibraryItem['type'], string> = {
    character: 'character design',
    product: 'product hero asset',
    environment: 'environment concept',
    style: 'style key visual',
  };

  const parts = [
    `Create a single clean ${typeText[type]} for "${name}".`,
    prompt,
    'One subject only, centered composition, plain studio-like background, no extra objects.',
    'No text, no watermark, no logo unless explicitly requested.',
    'High detail, production-ready reference image.',
  ];
  if (styleHint?.trim()) {
    parts.push(`Style hint: ${styleHint.trim()}`);
  }
  return parts.join(' ');
}

function buildAnalysisPrompt(type: CharacterLibraryItem['type'], angle: ViewAngle): string {
  const angleInstructions: Record<ViewAngle, string> = {
    front: '正面視角的',
    side: '側面視角的',
    three_quarter: '3/4 側面視角的',
    back: '背面視角的',
    top: '頂部俯視的',
    other: '',
  };
  const angleDesc = angleInstructions[angle] || '';

  const typeFocus: Record<CharacterLibraryItem['type'], string> = {
    product: '重點提取不可變商品特徵：外型輪廓、比例、Logo 位置、按鍵/介面配置、材質細節。',
    character: '重點提取不可變角色特徵：臉型與五官、髮型、服裝結構與代表性配件。',
    environment: '重點提取不可變場景特徵：主要構圖元素、空間關係、光源方向與色調。',
    style: '重點提取風格語言：筆觸/材質、色彩處理、光影語法、畫面顆粒或渲染方式。',
  };

  return `你是影像生成前處理器。請分析一張${angleDesc || ''}${type}參考圖，並輸出結構化 JSON。
${typeFocus[type]}

嚴格規則：
1) 只描述圖中看得見的內容，不可臆測不可見部分。
2) 不要輸出任何 JSON 以外內容。
3) mustKeep 必須是「不可改變」的關鍵項目，3-8 點，簡短可執行。
4) description 請是可直接注入到影像生成 prompt 的單段文字（80-180 字）。

輸出 JSON 結構（鍵名不可更改）：
{
  "description": "string",
  "mustKeep": ["string", "string"],
  "identityCore": "string",
  "materialLighting": "string",
  "styleTraits": "string",
  "angleVisibility": "string"
}`;
}

function parseStructuredAnalysis(raw: string): StructuredReferenceAnalysis {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(cleaned) as Partial<StructuredReferenceAnalysis>;
    const mustKeep = Array.isArray(parsed.mustKeep)
      ? parsed.mustKeep.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const description = String(parsed.description || '').trim();
    const fallbackDescription = [
      parsed.identityCore,
      parsed.materialLighting,
      parsed.styleTraits,
      parsed.angleVisibility,
    ]
      .filter(Boolean)
      .map((item) => String(item).trim())
      .join('；');

    return {
      description: description || fallbackDescription || cleaned,
      mustKeep,
      identityCore: parsed.identityCore?.trim(),
      materialLighting: parsed.materialLighting?.trim(),
      styleTraits: parsed.styleTraits?.trim(),
      angleVisibility: parsed.angleVisibility?.trim(),
    };
  } catch {
    return {
      description: cleaned,
      mustKeep: [],
    };
  }
}

async function imageUrlToDataUri(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('無法讀取生成圖片');
  }
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return NextResponse.json(
        { error: 'Client-provided apiKey is not allowed' },
        { status: 400 }
      );
    }

    const name = String(body?.name || '').trim();
    const type = sanitizeType(body?.type);
    const prompt = String(body?.prompt || '').trim();
    const styleHint = typeof body?.styleHint === 'string' ? body.styleHint.trim() : '';
    const tags = sanitizeTags(body?.tags);

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const falApiKey = process.env.FAL_API_KEY;
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;
    if (!falApiKey) {
      return NextResponse.json({ error: 'Missing FAL_API_KEY on server' }, { status: 500 });
    }
    if (!openrouterApiKey) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY on server' }, { status: 500 });
    }

    const imagePrompt = buildImagePrompt({ name, type, prompt, styleHint });
    const queue = await generateImage(
      imagePrompt,
      { aspectRatio: '1:1', resolution: '2K' },
      { apiKey: falApiKey }
    );
    const endpoint = process.env.FAL_IMAGE_MODEL || 'fal-ai/nano-banana-pro';
    const generatedImageUrl = await waitForImageUrl(queue.request_id, endpoint, falApiKey);

    const imageDataUri = await imageUrlToDataUri(generatedImageUrl);
    const analysisRaw = await analyzeReferenceImage(
      imageDataUri,
      buildAnalysisPrompt(type, 'front'),
      { apiKey: openrouterApiKey }
    );
    const analysis = parseStructuredAnalysis(analysisRaw);

    const generatedProfile = await generateCharacterProfile(
      {
        name,
        type,
        views: [
          {
            angle: 'front',
            description: analysis.description,
            mustKeepFeatures: analysis.mustKeep,
            identityCore: analysis.identityCore,
            styleTraits: analysis.styleTraits,
            angleVisibility: analysis.angleVisibility,
          },
        ],
      },
      { apiKey: openrouterApiKey }
    );

    const now = new Date().toISOString();
    const created = sqliteCharacterLibraryRepo.create({
      id: crypto.randomUUID(),
      name,
      type,
      description: generatedProfile.description || `${name} 角色參考`,
      guidelines: generatedProfile.guidelines || undefined,
      tags,
      views: [
        {
          angle: 'front',
          url: generatedImageUrl,
          description: analysis.description,
          mustKeepFeatures: analysis.mustKeep,
          identityCore: analysis.identityCore,
          styleTraits: analysis.styleTraits,
          angleVisibility: analysis.angleVisibility,
        },
      ],
      ipProfile: {
        profileVersion: 1,
        strictIdentity: true,
        allowAccessoryChanges: true,
        textLogoPolicy: 'forbid_new_text',
        immutableRules: [],
        generationDefaults: {
          preferredVideoModel: 'kling',
          preferredOutputAspectRatio: '16:9',
          preferredKlingDuration: 5,
          preferredSeedanceDuration: 5,
        },
      },
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      data: created,
      meta: {
        imagePrompt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Auto generate character error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto generate character' },
      { status: 500 }
    );
  }
}
