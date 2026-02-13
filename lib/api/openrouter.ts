import { PromptTemplate, StoryboardGenerationResponse, ProjectReference, TransitionType } from '../types/storyboard';
import { OpenRouterResponse } from '../types/api-responses';
import { buildSystemPrompt } from '../prompts/prompt-builder';
import { buildConsolidatedReferenceRules } from '../references/consistency-rules';
import { sanitizeStaticFrameDescription } from '../prompts/image-static';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;  // 預設: claude-3.5-sonnet
}

export interface StoryboardGenerationOptions {
  targetDurationSec?: number;
}

export async function generateStoryboardScript(
  userPrompt: string,
  template: PromptTemplate,
  config: OpenRouterConfig,
  references?: ProjectReference[],
  options?: StoryboardGenerationOptions
): Promise<StoryboardGenerationResponse> {
  const TRANSITION_TYPES: TransitionType[] = [
    'cut',
    'dissolve',
    'fade_black',
    'fade_white',
    'continuation',
    'match_cut',
    'wipe',
    'push',
  ];
  const isTransitionType = (value: string): value is TransitionType => TRANSITION_TYPES.includes(value as TransitionType);

  const stripMarkdownFence = (text: string) => {
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/i, '');
    else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/i, '');
    if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\s*```$/, '');
    return cleaned.trim();
  };

  const parseJsonContent = (content: string) => JSON.parse(stripMarkdownFence(content));
  const consolidatedRules = buildConsolidatedReferenceRules(references);
  const targetDurationSec = Number(options?.targetDurationSec);
  const hasTargetDuration = Number.isFinite(targetDurationSec) && targetDurationSec > 0;
  const targetSceneCount = hasTargetDuration
    ? Math.max(3, Math.min(7, Math.round(targetDurationSec / 5)))
    : undefined;
  const normalizedSceneLimit = targetSceneCount ?? 7;

  interface ConsistencyViolation {
    sceneNumber: number;
    message: string;
  }

  const extractTagSet = (text: string) => {
    const set = new Set<string>();
    const regex = /<([^>]+)>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]?.trim()) set.add(`<${match[1].trim()}>`);
    }
    return set;
  };

  const buildConsistencyViolations = (raw: unknown): ConsistencyViolation[] => {
    if (!raw || typeof raw !== 'object') return [];
    const scenes = Array.isArray((raw as Record<string, unknown>).scenes)
      ? ((raw as Record<string, unknown>).scenes as unknown[])
      : [];

    if (!scenes.length || !consolidatedRules.length) return [];

    const characterTagSet = new Set(
      consolidatedRules.filter(rule => rule.type === 'character').map(rule => rule.tag)
    );
    const productTagSet = new Set(
      consolidatedRules.filter(rule => rule.type === 'product').map(rule => rule.tag)
    );
    const appearanceKeywords = /(髮型|臉型|服裝|顏色|膚色|材質|logo|Logo|標誌|包裝文字)/;

    const violations: ConsistencyViolation[] = [];

    scenes.forEach((sceneRaw, index) => {
      if (!sceneRaw || typeof sceneRaw !== 'object') return;
      const scene = sceneRaw as Record<string, unknown>;
      const sceneNo = Number(scene.sceneNumber) || index + 1;
      const description = typeof scene.description === 'string' ? scene.description : '';
      const tagsInDescription = extractTagSet(description);

      const charactersUsed = new Set(
        Array.isArray(scene.charactersUsed)
          ? scene.charactersUsed.filter((value): value is string => typeof value === 'string')
          : []
      );
      const productsUsed = new Set(
        Array.isArray(scene.productsUsed)
          ? scene.productsUsed.filter((value): value is string => typeof value === 'string')
          : []
      );

      tagsInDescription.forEach(tag => {
        if (characterTagSet.has(tag) && !charactersUsed.has(tag)) {
          violations.push({
            sceneNumber: sceneNo,
            message: `description 出現 ${tag}，但 charactersUsed 缺少該標記。`,
          });
        }
        if (productTagSet.has(tag) && !productsUsed.has(tag)) {
          violations.push({
            sceneNumber: sceneNo,
            message: `description 出現 ${tag}，但 productsUsed 缺少該標記。`,
          });
        }
      });

      if (appearanceKeywords.test(description) && tagsInDescription.size > 0) {
        violations.push({
          sceneNumber: sceneNo,
          message: '描述含外觀細節關鍵詞，可能覆寫參考圖一致性。',
        });
      }
    });

    return violations;
  };

  const normalizeStoryboard = (input: unknown): StoryboardGenerationResponse => {
    const raw = (input && typeof input === 'object') ? (input as Record<string, unknown>) : {};
    const scenesRaw = Array.isArray(raw.scenes) ? raw.scenes : [];
    const normalizedScenes = scenesRaw.slice(0, normalizedSceneLimit).map((sceneRaw, index) => {
      const scene = (sceneRaw && typeof sceneRaw === 'object') ? (sceneRaw as Record<string, unknown>) : {};

      const transitionRaw =
        (scene.transitionToNext && typeof scene.transitionToNext === 'object')
          ? (scene.transitionToNext as Record<string, unknown>)
          : {};

      const transitionType = typeof transitionRaw.type === 'string' && isTransitionType(transitionRaw.type)
        ? transitionRaw.type
        : (index === scenesRaw.length - 1 ? 'fade_black' : 'dissolve');

      const requiresEndFrame = Boolean(scene.requiresEndFrame) || transitionType === 'continuation';
      const rawDescription = typeof scene.description === 'string' ? scene.description.trim() : '';
      const description = sanitizeStaticFrameDescription(rawDescription) || rawDescription;
      const endFrameDescriptionRaw = typeof scene.endFrameDescription === 'string'
        ? scene.endFrameDescription.trim()
        : '';
      const sanitizedEndFrame = sanitizeStaticFrameDescription(endFrameDescriptionRaw || description);
      const endFrameDescription = requiresEndFrame
        ? (sanitizedEndFrame || description)
        : '';

      const sceneNumberValue = Number(scene.sceneNumber);
      const sceneDurationValue = Number(scene.duration);
      const transitionDurationValue = Number(transitionRaw.duration);

      return {
        sceneNumber: Number.isFinite(sceneNumberValue) ? sceneNumberValue : index + 1,
        description,
        cameraMovement: typeof scene.cameraMovement === 'string' ? scene.cameraMovement.trim() : 'Static shot',
        requiresEndFrame,
        endFrameDescription,
        dialogue: typeof scene.dialogue === 'string' ? scene.dialogue.trim() : '',
        duration: Number.isFinite(sceneDurationValue) ? sceneDurationValue : 3,
        notes: typeof scene.notes === 'string' ? scene.notes.trim() : '',
        charactersUsed: Array.isArray(scene.charactersUsed)
          ? scene.charactersUsed.filter((v): v is string => typeof v === 'string')
          : [],
        productsUsed: Array.isArray(scene.productsUsed)
          ? scene.productsUsed.filter((v): v is string => typeof v === 'string')
          : [],
        changeFromPrev: typeof scene.changeFromPrev === 'string'
          ? scene.changeFromPrev.trim()
          : (index === 0 ? 'N/A' : ''),
        transitionToNext: {
          type: transitionType,
          reason: typeof transitionRaw.reason === 'string'
            ? transitionRaw.reason.trim()
            : 'Auto-normalized to keep scene continuity stable.',
          duration: Number.isFinite(transitionDurationValue) ? transitionDurationValue : 0.5,
          useEndFrameAsNextStart: typeof transitionRaw.useEndFrameAsNextStart === 'boolean'
            ? transitionRaw.useEndFrameAsNextStart
            : transitionType === 'continuation',
        },
      };
    });

    return {
      title: typeof raw.title === 'string' && raw.title.trim()
        ? raw.title.trim()
        : 'Storyboard',
      scenes: normalizedScenes,
    };
  };

  const callJsonCompletion = async (messages: Array<{ role: 'system' | 'user'; content: string }>) => {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'Storyboard System',
      },
      body: JSON.stringify({
        model: config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
        messages,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorData = await response.json();
        errorDetails = errorData.error?.message || JSON.stringify(errorData);
      } catch {
        errorDetails = await response.text();
      }
      throw new Error(`OpenRouter API error (${response.status}): ${errorDetails}`);
    }

    const data: OpenRouterResponse = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('OpenRouter 沒有回傳任何內容');
    return content;
  };

  // 使用 prompt builder 構建包含參考圖資訊的系統提示詞
  const systemPrompt = buildSystemPrompt(template, references);
  const outputSchemaText = JSON.stringify(template.outputSchema, null, 2);
  const firstPassContent = await callJsonCompletion([
    {
      role: 'system',
      content: `${systemPrompt}\n\n你必須以 JSON 格式回應，遵循以下結構：${outputSchemaText}`,
    },
    {
      role: 'user',
      content: `${userPrompt}

補充要求：
- ${hasTargetDuration ? `目標影片長度 ${targetDurationSec} 秒，按每場約 5 秒規劃，優先產出 ${targetSceneCount} 場。` : '以 5-7 場景為目標，優先可製作性。'}
- 角色與商品外觀一致性高於創意發散。
- requiresEndFrame 採保守判斷，非必要不要設 true。
- 只輸出 JSON，不要包含其他文字。`,
    },
  ]);

  console.log('第一輪分鏡回應（前 200 字）:', firstPassContent.substring(0, 200));

  let firstPassParsed: unknown;
  try {
    firstPassParsed = parseJsonContent(firstPassContent);
  } catch {
    console.error('第一輪 JSON 解析失敗，完整內容:', firstPassContent);
    throw new Error('AI 第一輪回傳格式錯誤，無法解析 JSON。');
  }

  const secondPassSystemPrompt = `你是分鏡腳本品質審核器。請修正既有 JSON，不要改變原始企劃核心。

修正優先順序：
1) 轉場合理性（與前後場景語義一致）
2) requiresEndFrame / endFrameDescription 邏輯一致
3) 角色與商品一致性（不可改變核心外觀）

規則：
- ${hasTargetDuration ? `保持約 ${targetSceneCount} 場（每場約 5 秒，總長約 ${targetDurationSec} 秒），除非原本不足，否則不要大幅增減。` : '保持 5-7 場景，除非原本不足，否則不要大幅增減。'}
- 若 transitionToNext.type = "continuation"，requiresEndFrame 必須為 true。
- 若 requiresEndFrame = false，endFrameDescription 必須是空字串 ""。
- 若 description 內使用 <角色>/<商品> 標記，charactersUsed/productsUsed 必須同步列出。
- 不可在 description 重新定義角色/商品外觀（髮型、服裝、顏色、材質、Logo 細節）。
- 只輸出 JSON。`;

  let finalParsed: unknown = firstPassParsed;
  try {
    const violations = buildConsistencyViolations(firstPassParsed);
    const secondPassContent = await callJsonCompletion([
      {
        role: 'system',
        content: `${secondPassSystemPrompt}\n\n請遵循以下 JSON 結構：${outputSchemaText}`,
      },
      {
        role: 'user',
        content: `參考規則（合併後）：
${JSON.stringify(consolidatedRules, null, 2)}

檢查到的疑似問題：
${violations.length ? violations.map(v => `- Scene ${v.sceneNumber}: ${v.message}`).join('\n') : '- 無明顯違規，請只做最小修正。'}

請修正這份分鏡 JSON：
${JSON.stringify(firstPassParsed, null, 2)}`,
      },
    ]);
    console.log('第二輪修正回應（前 200 字）:', secondPassContent.substring(0, 200));
    finalParsed = parseJsonContent(secondPassContent);
  } catch (error) {
    console.warn('第二輪修正失敗，改用第一輪結果:', error);
  }

  const normalized = normalizeStoryboard(finalParsed);
  const finalViolations = buildConsistencyViolations(normalized);
  const violationMap = new Map<number, string[]>();
  finalViolations.forEach(violation => {
    const list = violationMap.get(violation.sceneNumber) || [];
    list.push(violation.message);
    violationMap.set(violation.sceneNumber, list);
  });

  return {
    ...normalized,
    scenes: normalized.scenes.map(scene => ({
      ...scene,
      consistencyWarnings: violationMap.get(scene.sceneNumber) || [],
    })),
  };
}

/**
 * 分析參考圖片
 */
export async function analyzeReferenceImage(
  base64Image: string,
  prompt: string,
  config: OpenRouterConfig
): Promise<string> {
  const model = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-001';

  // 處理 base64 圖片格式
  // OpenRouter 預期 URL 格式或 base64 data URI
  // 如果輸入已經是 data URI (data:image/...) 則直接使用，否則加上前綴
  const imageUrl = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'X-Title': 'Storyboard System',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorData = await response.json();
      errorDetails = errorData.error?.message || JSON.stringify(errorData);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(`OpenRouter API error (${response.status}): ${errorDetails}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('OpenRouter 沒有回傳任何內容');
  }

  return content;
}

export interface CharacterProfileGenerationInput {
  name: string;
  type: 'character' | 'product' | 'environment' | 'style';
  views: Array<{
    angle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';
    description: string;
    mustKeepFeatures?: string[];
    identityCore?: string;
    styleTraits?: string;
    angleVisibility?: string;
  }>;
}

export interface CharacterProfileGenerationResult {
  description: string;
  guidelines: string;
}

export async function generateCharacterProfile(
  input: CharacterProfileGenerationInput,
  config: OpenRouterConfig
): Promise<CharacterProfileGenerationResult> {
  const model = config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

  const systemPrompt = `你是品牌素材規格編輯器。請根據多視角分析資料，輸出可直接用於影像生成的一致性設定。

規則：
1) 僅輸出 JSON，不要任何額外文字。
2) description：80-180 字，聚焦外觀與可視化特徵，不寫宣傳文案。
3) guidelines：5-8 條「不可改變」規則，以「1.」「2.」編號列出，每條一句。
4) 若輸入是商品，優先保護比例、Logo、關鍵元件位置、材質與色彩。
5) 若輸入是角色，優先保護臉部、髮型、服裝、代表配件。
6) 若資訊不足，請依現有資料保守整理，不可杜撰不存在元素。`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'X-Title': 'Storyboard System',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `請整理以下素材資料：\n${JSON.stringify(input, null, 2)}\n\n請輸出 JSON：{"description":"...","guidelines":"..."}`,
        },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorData = await response.json();
      errorDetails = errorData.error?.message || JSON.stringify(errorData);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(`OpenRouter API error (${response.status}): ${errorDetails}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('OpenRouter 沒有回傳任何內容');
  }

  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(cleaned) as Partial<CharacterProfileGenerationResult>;
    return {
      description: (parsed.description || '').trim(),
      guidelines: (parsed.guidelines || '').trim(),
    };
  } catch {
    throw new Error('角色設定生成回傳格式錯誤，無法解析 JSON');
  }
}
