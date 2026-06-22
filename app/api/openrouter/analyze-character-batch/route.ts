import { NextRequest, NextResponse } from 'next/server';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const maxDuration = 90;

type Angle = 'front' | 'side' | 'side_left' | 'side_right' | 'three_quarter' | 'back' | 'top' | 'other';
type RenderingMedium = 'flat_2d' | 'cel_3d' | 'clay_3d' | 'photoreal' | 'painterly' | 'mixed';

interface ViewInput {
  angle: Angle;
  imageBase64: string;
}

interface BatchAnalysisRequest {
  name?: string;
  type?: 'character' | 'product' | 'environment' | 'style';
  userNote?: string;
  views: ViewInput[];
}

interface DriftHotspotAnalysis {
  part: string;
  correctShape?: string;
  commonFailures: string[];
}

interface ActionSafetyAnalysis {
  forbiddenVerbs?: string[];
  rewriteRules?: Array<{ trigger: string; rewrite: string }>;
  anatomyConstraints?: string[];
}

interface CanonicalAnalysis {
  // v2 structured
  identityAnchor: string;
  renderingMedium?: RenderingMedium;
  styleDirective: string;
  preserveList: string[];
  driftHotspots: DriftHotspotAnalysis[];
  actionSafety?: ActionSafetyAnalysis;
  // v1 legacy fallback (synthesised from v2 for older UI)
  identityCore: string;
  mustKeepFeatures: string[];
  description: string;
}

interface PerViewAnalysis {
  angle: Angle;
  // v2
  visibleFeatures: string[];
  hiddenFeatures: string[];
  // v1 fallback
  description: string;
  angleVisibility?: string;
  styleTraits?: string;
}

interface BatchAnalysisResponse {
  canonical: CanonicalAnalysis;
  perView: PerViewAnalysis[];
}

const ANGLE_LABELS: Record<Angle, string> = {
  front: '正面',
  side: '側面',
  side_left: '左側',
  side_right: '右側',
  three_quarter: '3/4 側',
  back: '背面',
  top: '頂視',
  other: '其他',
};

const VALID_MEDIUMS: readonly RenderingMedium[] = ['flat_2d', 'cel_3d', 'clay_3d', 'photoreal', 'painterly', 'mixed'];

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

function getAppOrigin(): string {
  return process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN || 'http://localhost:3000';
}

function normalizeImageUrl(imageBase64: string): string {
  if (imageBase64.startsWith('data:')) return imageBase64;
  return `data:image/jpeg;base64,${imageBase64}`;
}

function cleanJsonText(content: string): string {
  return content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function buildSystemPrompt(type: string, name: string, userNote: string | undefined, angles: Angle[]): string {
  const typeFocusMap: Record<string, string> = {
    product: '商品 — 優先保護幾何比例、Logo 位置、關鍵元件配置、材質與顏色。',
    character: '角色／吉祥物 — 優先保護剪影、臉部/眼睛配置、渲染媒介、代表配件。',
    environment: '場景 — 優先保護空間關係、主要元素佈局、光源方向與色調。',
    style: '風格 — 優先保護筆觸/材質語言、色彩處理、光影語法。',
  };

  const angleList = angles.map((a, i) => `${i + 1}. ${ANGLE_LABELS[a]} (${a})`).join('\n');
  const userNoteBlock = userNote?.trim() ? `\n使用者補充：${userNote.trim()}\n` : '';

  return `You are a vision pre-processor for image-generation prompts. You receive multi-view reference images of a single subject ("${name || 'unnamed'}") and must output a canonical, structured identity specification optimized for reasoning-based image models (gpt-image-2, Seedream 4.0, nano-banana-pro).

Type focus: ${typeFocusMap[type] || typeFocusMap.character}
${userNoteBlock}
Angles received (in order):
${angleList}

CRITICAL OUTPUT RULES:
1) Output only JSON. No markdown fences, no explanation.
2) All **free-text fields MUST be English**. Chinese characters in prompts cause token leak into generated images. Short proper nouns in names are OK; everything else must be English.
3) identityAnchor is a **single English noun phrase ≤200 chars**, designed as the FIRST sentence of an image prompt. It must read like: "a round white vinyl-robot mascot with two asymmetric O-shaped eyes" — not a description paragraph, not a sentence with verbs.
4) renderingMedium is the *designed* medium of the character. Pick exactly one of: flat_2d (vector flat, bold black outlines), cel_3d (3D with toon shading), clay_3d (clay/felt/handmade), photoreal, painterly, mixed. This prevents models from auto-3D-ifying a 2D mascot.
5) styleDirective is a **short trailing-style phrase** (≤120 chars) appended verbatim to prompts. Examples: "flat 2D vector, thick black outlines, no gradients", "soft clay material, studio lighting, 3D render". Do NOT include identity traits here.
6) preserveList has 4-8 short noun phrases (≤40 chars each), each **visually verifiable** (color, shape, position, proportion, marking). No abstract adjectives. This replaces older free-text mustKeepFeatures.
7) driftHotspots has 2-5 entries targeting parts where diffusion/reasoning priors commonly break this subject. Common hotspots for mascots: hands (models add 5 articulated fingers), feet (models add 3D rounded shoes), eyes (models symmetrize asymmetric eyes), mouth (models add teeth), limbs (models separate fused limbs). For each: { part, correctShape (2-3 sentences describing the correct form), commonFailures (array of specific wrong outcomes to avoid) }.
8) actionSafety is optional but STRONGLY RECOMMENDED for non-human characters. Populate:
   - forbiddenVerbs: verbs that trigger wrong priors (e.g., "hold", "grip", "grasp" trigger 5-finger priors on mitten-handed mascots).
   - rewriteRules: safer phrasings, e.g. { trigger: "hold phone", rewrite: "phone balanced on open mitten palm" }.
   - anatomyConstraints: absolute constraints, e.g. ["no fingers", "no separated toes", "limbs remain fused to body"].
9) Per-view output: for each angle, list visibleFeatures (3-6 phrases — what's *clearly* visible at this angle) and hiddenFeatures (2-4 phrases — what's *not* visible; prevents downstream prompts from demanding impossible features). Keep phrases short and visually grounded.
10) Also output legacy fallback fields (identityCore, mustKeepFeatures, description, per-view description, angleVisibility, styleTraits) by restating the v2 content in full-sentence form. These exist for back-compat with older consumers.
11) Never invent details not visible in the images. If a feature's shape is unclear across all views, omit it from preserveList instead of guessing.

Output JSON schema:
{
  "canonical": {
    "identityAnchor": "string (English noun phrase, ≤200 chars)",
    "renderingMedium": "flat_2d|cel_3d|clay_3d|photoreal|painterly|mixed",
    "styleDirective": "string (English, short trailing style phrase)",
    "preserveList": ["short English noun phrase", ...],
    "driftHotspots": [
      { "part": "string", "correctShape": "string", "commonFailures": ["string", ...] }
    ],
    "actionSafety": {
      "forbiddenVerbs": ["string", ...],
      "rewriteRules": [{ "trigger": "string", "rewrite": "string" }],
      "anatomyConstraints": ["string", ...]
    },
    "identityCore": "string (English, legacy fallback, 1-2 sentences)",
    "mustKeepFeatures": ["string", ...],
    "description": "string (English, legacy fallback, 2-3 sentences)"
  },
  "perView": [
    {
      "angle": "front|side|side_left|side_right|three_quarter|back|top|other",
      "visibleFeatures": ["string", ...],
      "hiddenFeatures": ["string", ...],
      "description": "string (legacy fallback)",
      "angleVisibility": "string (legacy fallback)",
      "styleTraits": "string (legacy fallback)"
    }
  ]
}

perView array order MUST match the input angle list exactly.`;
}

function coerceStringArray(value: unknown, maxLen = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0 && v.length <= maxLen);
}

function coerceMedium(value: unknown): RenderingMedium | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase().trim() as RenderingMedium;
  return VALID_MEDIUMS.includes(lower) ? lower : undefined;
}

function coerceDriftHotspots(value: unknown): DriftHotspotAnalysis[] {
  if (!Array.isArray(value)) return [];
  const out: DriftHotspotAnalysis[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;
    const part = typeof obj.part === 'string' ? obj.part.trim() : '';
    if (!part) continue;
    const commonFailures = coerceStringArray(obj.commonFailures, 120);
    const correctShapeRaw = typeof obj.correctShape === 'string' ? obj.correctShape.trim() : '';
    const hotspot: DriftHotspotAnalysis = { part, commonFailures };
    if (correctShapeRaw) hotspot.correctShape = correctShapeRaw;
    out.push(hotspot);
  }
  return out;
}

function coerceActionSafety(value: unknown): ActionSafetyAnalysis | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  const forbiddenVerbs = coerceStringArray(obj.forbiddenVerbs, 40);
  const anatomyConstraints = coerceStringArray(obj.anatomyConstraints, 120);
  const rewriteRules = Array.isArray(obj.rewriteRules)
    ? obj.rewriteRules
        .map((r) => {
          if (!r || typeof r !== 'object') return null;
          const rule = r as Record<string, unknown>;
          const trigger = typeof rule.trigger === 'string' ? rule.trigger.trim() : '';
          const rewrite = typeof rule.rewrite === 'string' ? rule.rewrite.trim() : '';
          if (!trigger || !rewrite) return null;
          return { trigger, rewrite };
        })
        .filter((x): x is { trigger: string; rewrite: string } => x !== null)
    : [];

  if (forbiddenVerbs.length === 0 && anatomyConstraints.length === 0 && rewriteRules.length === 0) {
    return undefined;
  }
  return {
    forbiddenVerbs: forbiddenVerbs.length > 0 ? forbiddenVerbs : undefined,
    rewriteRules: rewriteRules.length > 0 ? rewriteRules : undefined,
    anatomyConstraints: anatomyConstraints.length > 0 ? anatomyConstraints : undefined,
  };
}

function parseBatchAnalysis(raw: string, expectedAngles: Angle[]): BatchAnalysisResponse {
  const cleaned = cleanJsonText(raw);
  const parsed = JSON.parse(cleaned) as Partial<{
    canonical: Record<string, unknown>;
    perView: Array<Record<string, unknown>>;
  }>;

  const canonicalRaw = parsed.canonical || {};

  const identityAnchor = String(canonicalRaw.identityAnchor || canonicalRaw.identityCore || '').trim();
  const identityCoreFallback =
    String(canonicalRaw.identityCore || '').trim() || identityAnchor;
  const preserveList = coerceStringArray(canonicalRaw.preserveList, 80);
  const mustKeepFallback = preserveList.length > 0
    ? preserveList
    : coerceStringArray(canonicalRaw.mustKeepFeatures, 80);
  const styleDirective = String(canonicalRaw.styleDirective || '').trim();
  const description = String(canonicalRaw.description || '').trim() || identityAnchor;

  const canonical: CanonicalAnalysis = {
    identityAnchor,
    renderingMedium: coerceMedium(canonicalRaw.renderingMedium),
    styleDirective,
    preserveList: preserveList.length > 0 ? preserveList : mustKeepFallback,
    driftHotspots: coerceDriftHotspots(canonicalRaw.driftHotspots),
    actionSafety: coerceActionSafety(canonicalRaw.actionSafety),
    identityCore: identityCoreFallback,
    mustKeepFeatures: mustKeepFallback,
    description,
  };

  const perViewRaw = Array.isArray(parsed.perView) ? parsed.perView : [];
  const byAngle = new Map<Angle, PerViewAnalysis>();
  for (const entry of perViewRaw) {
    const angle = entry.angle as Angle | undefined;
    if (!angle) continue;
    byAngle.set(angle, {
      angle,
      visibleFeatures: coerceStringArray(entry.visibleFeatures, 80),
      hiddenFeatures: coerceStringArray(entry.hiddenFeatures, 80),
      description: String(entry.description || '').trim(),
      angleVisibility: entry.angleVisibility ? String(entry.angleVisibility).trim() : undefined,
      styleTraits: entry.styleTraits ? String(entry.styleTraits).trim() : undefined,
    });
  }

  const perView: PerViewAnalysis[] = expectedAngles.map(
    (angle) =>
      byAngle.get(angle) || {
        angle,
        visibleFeatures: [],
        hiddenFeatures: [],
        description: '',
        angleVisibility: undefined,
        styleTraits: undefined,
      }
  );

  return { canonical, perView };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BatchAnalysisRequest;

    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
    }

    const views = Array.isArray(body.views) ? body.views : [];
    if (views.length === 0) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, '至少提供一張視角圖片');
    }
    if (views.length > 8) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, '單次批次分析最多 8 張視角');
    }
    for (const view of views) {
      if (!view.imageBase64 || !view.angle) {
        return apiError(API_ERROR_CODES.MISSING_FIELD, '每個視角需包含 angle 與 imageBase64');
      }
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
    }

    const model = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-3.5-flash';
    const type = body.type || 'character';
    const name = body.name?.trim() || '';
    const angles = views.map((v) => v.angle);
    const systemPrompt = buildSystemPrompt(type, name, body.userNote, angles);

    const userContent: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: `以下依序是 ${views.length} 張視角參考圖。請按這個順序在 perView 中回傳結果：\n${angles
          .map((a, i) => `${i + 1}. ${ANGLE_LABELS[a]} (${a})`)
          .join('\n')}`,
      },
    ];

    for (let i = 0; i < views.length; i += 1) {
      userContent.push({ type: 'text', text: `[${i + 1}] ${ANGLE_LABELS[views[i]!.angle]} (${views[i]!.angle})` });
      userContent.push({
        type: 'image_url',
        image_url: { url: normalizeImageUrl(views[i]!.imageBase64) },
      });
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': getAppOrigin(),
        'X-Title': 'Storyboard System',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      let details = '';
      try {
        const err = await response.json();
        details = err.error?.message || JSON.stringify(err);
      } catch {
        details = await response.text();
      }
      return apiError(API_ERROR_CODES.UPSTREAM_ERROR, `OpenRouter vision error (${response.status}): ${details}`);
    }

    const data = await response.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      return apiError(API_ERROR_CODES.UPSTREAM_ERROR, 'OpenRouter 沒有回傳內容');
    }

    let parsed: BatchAnalysisResponse;
    try {
      parsed = parseBatchAnalysis(content, angles);
    } catch (error) {
      return apiError(
        API_ERROR_CODES.UPSTREAM_ERROR,
        `批次分析 JSON 解析失敗：${error instanceof Error ? error.message : '未知錯誤'}`
      );
    }

    return NextResponse.json({
      success: true,
      ...parsed,
      metadata: {
        angles,
        model,
        type,
        schemaVersion: 2,
      },
    });
  } catch (error) {
    console.error('Character batch analysis error:', error);
    return apiErrorFromUnknown(error, { message: '批次分析失敗' });
  }
}
