import { PromptTemplate, StoryboardGenerationResponse, ProjectReference, Scene, TransitionType } from '../types/storyboard';
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
  const stringValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const hasKeywords = (value: string, regex: RegExp) => regex.test(value);
  const hasTerminalCameraTarget = (cameraMovement: string) =>
    hasKeywords(
      cameraMovement,
      /(from\s+.*\s+to|ending\s+with|end\s+on|reveal|land\s+on|最後|最終|結尾|從.+到|由.+到|聚焦到|露出|轉到)/i
    );
  const hasStrongReframingMotion = (cameraMovement: string) =>
    hasKeywords(
      cameraMovement,
      /(pan|tilt|dolly|zoom|truck|crane|orbit|arc|push\s*in|pull\s*out|reframe|平移|推軌|拉近|拉遠|環繞|移鏡|搖鏡|轉向)/i
    );
  const hasStateChangeSignal = (text: string) =>
    hasKeywords(
      text,
      /(open|close|pour|transform|move\s+to|pick\s+up|put\s+down|slide|fold|unfold|打開|關閉|倒出|移到|拿起|放下|展開|收合|亮起|熄滅|變形|切換狀態)/i
    );
  const inferEndFrameDeltaFromCameraMovement = (cameraMovement: string) => {
    const movement = cameraMovement.toLowerCase();

    if (/pan\s+right|右移|向右/.test(movement)) {
      return '鏡頭右移至最終落點；主體在畫面中相對左移，右側新增可見環境內容；世界座標與道具實際位置保持連續。';
    }
    if (/pan\s+left|左移|向左/.test(movement)) {
      return '鏡頭左移至最終落點；主體在畫面中相對右移，左側新增可見環境內容；世界座標與道具實際位置保持連續。';
    }
    if (/dolly\s*in|push\s*in|拉近|推近|推軌近/.test(movement)) {
      return '鏡頭推近至最終落點；主體在畫面中比例增加、背景可視範圍減少；主體與道具世界位置不改變。';
    }
    if (/dolly\s*out|pull\s*out|拉遠|推軌遠/.test(movement)) {
      return '鏡頭拉遠至最終落點；主體在畫面中比例縮小、可視環境範圍增加；主體與道具世界位置不改變。';
    }
    if (/zoom\s*in|放大|變焦近/.test(movement)) {
      return '鏡頭變焦放大到最終構圖；主體更聚焦且畫面裁切更緊；不可改變物體世界位置或幾何。';
    }
    if (/zoom\s*out|縮小|變焦遠/.test(movement)) {
      return '鏡頭變焦縮小到最終構圖；畫面可見範圍增加；不可改變物體世界位置或幾何。';
    }
    if (/tilt\s+up|上仰|向上傾/.test(movement)) {
      return '鏡頭上仰到最終落點；畫面上方可見內容增加；世界幾何與道具位置保持連續。';
    }
    if (/tilt\s+down|下俯|向下傾/.test(movement)) {
      return '鏡頭下俯到最終落點；畫面下方可見內容增加；世界幾何與道具位置保持連續。';
    }

    return '';
  };

  const shouldRequireEndFrame = ({
    explicitRequiresEndFrame,
    transitionType,
    cameraMovement,
    endFrameDescription,
    endFrameDelta,
    description,
  }: {
    explicitRequiresEndFrame?: boolean;
    transitionType: TransitionType;
    cameraMovement: string;
    endFrameDescription: string;
    endFrameDelta: string;
    description: string;
  }) => {
    if (transitionType === 'continuation') return true;

    const hasExplicitDelta = Boolean(endFrameDelta);
    const hasExplicitEndFrame = Boolean(endFrameDescription && endFrameDescription !== description);
    const stateChangeDetected = hasStateChangeSignal(`${cameraMovement} ${endFrameDelta} ${endFrameDescription}`);
    const cameraNeedsTerminalState = hasStrongReframingMotion(cameraMovement) && hasTerminalCameraTarget(cameraMovement);

    if (hasExplicitDelta || hasExplicitEndFrame) return true;
    if (stateChangeDetected) return true;
    if (cameraNeedsTerminalState) return true;

    return Boolean(explicitRequiresEndFrame && stateChangeDetected);
  };

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

      const rawDescription = stringValue(scene.description);
      const description = sanitizeStaticFrameDescription(rawDescription) || rawDescription;
      const endFrameDescriptionRaw = stringValue(scene.endFrameDescription);
      const endFrameDeltaRaw = stringValue(scene.endFrameDelta);
      const explicitRequiresEndFrame = typeof scene.requiresEndFrame === 'boolean'
        ? scene.requiresEndFrame
        : undefined;
      const requiresEndFrame = shouldRequireEndFrame({
        explicitRequiresEndFrame,
        transitionType,
        cameraMovement: stringValue(scene.cameraMovement),
        endFrameDescription: endFrameDescriptionRaw,
        endFrameDelta: endFrameDeltaRaw,
        description,
      });
      const sanitizedEndFrame = sanitizeStaticFrameDescription(endFrameDescriptionRaw || description);
      const sceneIntent = stringValue((scene as Record<string, unknown>).sceneIntent)
        || stringValue(scene.shotIntent)
        || stringValue(scene.beatGoal)
        || `完成場景 ${index + 1} 的敘事目標`;
      const startComposition = sanitizeStaticFrameDescription(
        stringValue((scene as Record<string, unknown>).startComposition) || description
      ) || description;
      const subjectMotion = stringValue((scene as Record<string, unknown>).subjectMotion)
        || '主體保持穩定，僅做必要動作。';
      const continuityLock = stringValue((scene as Record<string, unknown>).continuityLock)
        || stringValue(scene.continuityAnchor)
        || '保持角色/商品身份、空間幾何與關鍵道具相對位置一致。';
      const endFrameDelta = requiresEndFrame
        ? (
          sanitizeStaticFrameDescription(
            endFrameDeltaRaw
            || (endFrameDescriptionRaw && endFrameDescriptionRaw !== description ? endFrameDescriptionRaw : '')
          )
          || inferEndFrameDeltaFromCameraMovement(stringValue(scene.cameraMovement))
          || `鏡頭完成運動後落在「${stringValue(scene.cameraMovement) || '最終構圖'}」所指定的終態構圖。`
        )
        : '';
      const endFrameDeltaSpecRaw =
        scene.endFrameDeltaSpec && typeof scene.endFrameDeltaSpec === 'object'
          ? (scene.endFrameDeltaSpec as Record<string, unknown>)
          : {};
      const inferredSpec = {
        reframingGoal: endFrameDelta,
        subjectScaleChangePct: hasStrongReframingMotion(stringValue(scene.cameraMovement))
          ? (/(dolly\s*in|push\s*in|zoom\s*in|拉近|放大)/i.test(stringValue(scene.cameraMovement)) ? '+10%~+20%' : /(dolly\s*out|pull\s*out|zoom\s*out|拉遠|縮小)/i.test(stringValue(scene.cameraMovement)) ? '-10%~-20%' : '0%~+10%')
          : '0%',
        newVisibleArea: /(pan\s+right|右移|向右)/i.test(stringValue(scene.cameraMovement))
          ? '右側環境新增可見區'
          : /(pan\s+left|左移|向左)/i.test(stringValue(scene.cameraMovement))
            ? '左側環境新增可見區'
            : '依鏡頭終態可見範圍自然變化',
        mustNotChange: [
          '角色/商品身份',
          '品牌 logo 與文字拼寫',
          '靜態空間幾何',
        ],
      };
      const endFrameDeltaSpec = requiresEndFrame
        ? {
          reframingGoal: stringValue(endFrameDeltaSpecRaw.reframingGoal) || inferredSpec.reframingGoal,
          subjectScaleChangePct: stringValue(endFrameDeltaSpecRaw.subjectScaleChangePct) || inferredSpec.subjectScaleChangePct,
          newVisibleArea: stringValue(endFrameDeltaSpecRaw.newVisibleArea) || inferredSpec.newVisibleArea,
          mustNotChange: Array.isArray(endFrameDeltaSpecRaw.mustNotChange)
            ? endFrameDeltaSpecRaw.mustNotChange.filter((v): v is string => typeof v === 'string')
            : inferredSpec.mustNotChange,
        }
        : undefined;
      const endFrameDescription = requiresEndFrame
        ? (sanitizedEndFrame || `${startComposition}。僅變更：${endFrameDelta}`)
        : '';

      const sceneNumberValue = Number(scene.sceneNumber);
      const sceneDurationValue = Number(scene.duration);
      const transitionDurationValue = Number(transitionRaw.duration);

      return {
        sceneNumber: Number.isFinite(sceneNumberValue) ? sceneNumberValue : index + 1,
        description,
        sceneIntent,
        startComposition,
        subjectMotion,
        continuityLock,
        cameraMovement: typeof scene.cameraMovement === 'string' ? scene.cameraMovement.trim() : 'Static shot',
        requiresEndFrame,
        endFrameDescription,
        endFrameDelta,
        endFrameDeltaSpec,
        dialogue: typeof scene.dialogue === 'string' ? scene.dialogue.trim() : '',
        duration: Number.isFinite(sceneDurationValue) ? sceneDurationValue : 3,
        notes: typeof scene.notes === 'string' ? scene.notes.trim() : '',
        beatGoal: typeof scene.beatGoal === 'string' ? scene.beatGoal.trim() : '',
        shotIntent: typeof scene.shotIntent === 'string' ? scene.shotIntent.trim() : '',
        continuityAnchor: typeof scene.continuityAnchor === 'string' ? scene.continuityAnchor.trim() : '',
        requiredReferences: Array.isArray(scene.requiredReferences)
          ? scene.requiredReferences.filter((v): v is string => typeof v === 'string')
          : [],
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
- 若 requiresEndFrame = false，endFrameDelta 也必須是空字串 ""。
- 每個場景都要有 sceneIntent/startComposition/subjectMotion/continuityLock。
- endFrameDelta 必須用「相對首幀差異」描述，不可重寫整個場景。
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

export async function regenerateStoryboardScene(
  userPrompt: string,
  template: PromptTemplate,
  targetScene: Partial<Scene> & { sceneNumber: number },
  scenesContext: Array<Pick<Scene, 'sceneNumber' | 'description' | 'cameraMovement' | 'dialogue' | 'duration'>>,
  config: OpenRouterConfig,
  references?: ProjectReference[]
): Promise<Partial<Scene>> {
  const model = config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  const systemPrompt = buildSystemPrompt(template, references);
  const sceneSchema = {
    type: 'object',
    properties: {
      sceneNumber: { type: 'integer' },
      description: { type: 'string' },
      cameraMovement: { type: 'string' },
      sceneIntent: { type: 'string' },
      startComposition: { type: 'string' },
      subjectMotion: { type: 'string' },
      continuityLock: { type: 'string' },
      requiresEndFrame: { type: 'boolean' },
      endFrameDescription: { type: 'string' },
      endFrameDelta: { type: 'string' },
      dialogue: { type: 'string' },
      duration: { type: 'number' },
      notes: { type: 'string' },
      charactersUsed: { type: 'array', items: { type: 'string' } },
      productsUsed: { type: 'array', items: { type: 'string' } },
      changeFromPrev: { type: 'string' },
      transitionToNext: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['cut', 'dissolve', 'fade_black', 'fade_white', 'continuation', 'match_cut', 'wipe', 'push'],
          },
          reason: { type: 'string' },
          duration: { type: 'number' },
          useEndFrameAsNextStart: { type: 'boolean' },
        },
        required: ['type', 'reason'],
      },
    },
    required: ['sceneNumber', 'description', 'cameraMovement', 'sceneIntent', 'startComposition', 'subjectMotion', 'continuityLock', 'requiresEndFrame', 'endFrameDelta', 'dialogue', 'duration', 'charactersUsed', 'productsUsed', 'changeFromPrev', 'transitionToNext'],
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Storyboard System',
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}

你現在是「單場景修復器」：只重寫指定場景，保持整體企劃不變。
請輸出 JSON：{ "scene": <sceneObject> }，scene 必須符合 schema:
${JSON.stringify(sceneSchema, null, 2)}

規則：
- 只允許改動目標場景，不要改場景編號。
- 優先修正：運鏡可執行性、endFrameDelta 可執行性、連續性約束清楚。
- endFrameDelta 僅描述相對首幀差異，不可重寫整景。
- 若運鏡有 pan/dolly/zoom 終態，requiresEndFrame 應為 true。`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            originalPrompt: userPrompt,
            targetSceneNumber: targetScene.sceneNumber,
            targetScene,
            scenesContext,
          }, null, 2),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${text}`);
  }
  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('OpenRouter 沒有回傳內容');

  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const parsed = JSON.parse(cleaned) as { scene?: Partial<Scene> };
  if (!parsed.scene) throw new Error('回傳缺少 scene');
  return parsed.scene;
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
