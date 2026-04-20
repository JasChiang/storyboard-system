import { PromptTemplate, StoryboardGenerationResponse, ProjectReference, Scene, TransitionType, CreativeReview, HookVariant, type RenderLane, type ProductionRisk, type ReferencePriorityMode, type SharedContinuityDirective, type ViewIntent } from '../types/storyboard';
import { OpenRouterResponse } from '../types/api-responses';
import { buildSystemPrompt } from '../prompts/prompt-builder';
import { buildConsolidatedReferenceRules } from '../references/consistency-rules';
import { getSceneReferencePlan } from '../references/reference-plan';
import { normalizeTag } from '../references/scene-references';
import { sanitizeStaticFrameDescription } from '../prompts/image-static';
import { STORYBOARD_CONTRACT_PROMPT_BLOCK, STORYBOARD_PRODUCTION_RISKS, STORYBOARD_REFERENCE_PRIORITY_MODES, STORYBOARD_RENDER_LANES, STORYBOARD_VIEW_INTENTS } from '../prompts/storyboard-contract';
import type {
  ElevenLabsMusicPromptIdea,
  IndexTtsEmotionalStrengths,
  IndexTtsRequestInput,
  IndexTtsScenePlan,
  IndexTtsScenePlanningInput,
} from '../types/audio';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_APP_ORIGIN = 'http://localhost:3000';
const JSON_SCHEMA_UNSUPPORTED_PATTERN = /(json_schema|response_format|strict|unsupported|not supported|invalid schema)/i;
const JSON_SCHEMA_FALLBACK_PROVIDER_PATTERN = /(provider returned error|invalid request|invalid input|bad request|schema)/i;

type OpenRouterMessage = { role: 'system' | 'user'; content: string };
type OpenRouterJsonSchema = Record<string, unknown>;

function getAppOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN || DEFAULT_APP_ORIGIN;
}

function cleanJsonText(content: string): string {
  return content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function createOpenRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': getAppOrigin(),
    'X-Title': 'Storyboard System',
  };
}

function parseOpenRouterErrorDetails(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const record = raw as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return JSON.stringify(raw);
}

async function readOpenRouterError(response: Response): Promise<string> {
  try {
    return parseOpenRouterErrorDetails(await response.json());
  } catch {
    return await response.text();
  }
}

function buildStrictJsonResponseFormat(schemaName: string, schema: OpenRouterJsonSchema) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: schemaName,
      strict: true,
      schema,
    },
  };
}

async function callOpenRouterJson<T>({
  apiKey,
  model,
  messages,
  schemaName,
  schema,
}: {
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  schemaName: string;
  schema: OpenRouterJsonSchema;
}): Promise<T> {
  const responseFormats = [
    buildStrictJsonResponseFormat(schemaName, schema),
    { type: 'json_object' as const },
  ];
  let fallbackReason = '';

  for (let index = 0; index < responseFormats.length; index += 1) {
    const format = responseFormats[index];
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: createOpenRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        response_format: format,
      }),
    });

    if (!response.ok) {
      const errorDetails = await readOpenRouterError(response);
      if (
        index === 0
        && (
          JSON_SCHEMA_UNSUPPORTED_PATTERN.test(errorDetails)
          || (response.status === 400 && JSON_SCHEMA_FALLBACK_PROVIDER_PATTERN.test(errorDetails))
        )
      ) {
        fallbackReason = errorDetails;
        continue;
      }
      throw new Error(`OpenRouter API error (${response.status}): ${errorDetails}`);
    }

    if (index === 1 && fallbackReason) {
      console.warn('[OpenRouter] json_schema unsupported; fallback to json_object:', fallbackReason);
    }

    const data: OpenRouterResponse = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('OpenRouter 沒有回傳任何內容');

    try {
      return JSON.parse(cleanJsonText(content)) as T;
    } catch (error) {
      throw new Error(`OpenRouter 回傳格式錯誤，無法解析 JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  throw new Error('OpenRouter JSON schema 與 json_object 都不可用。');
}

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;  // 預設: claude-3.5-sonnet
}

export interface StoryboardGenerationOptions {
  targetDurationSec?: number;
  targetSceneCount?: number;
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
    cameraMovement,
    endFrameDescription,
    endFrameDelta,
    description,
  }: {
    explicitRequiresEndFrame?: boolean;
    cameraMovement: string;
    endFrameDescription: string;
    endFrameDelta: string;
    description: string;
  }) => {
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
  const rawManualSceneCount = Number(options?.targetSceneCount);
  const manualSceneCount = Number.isFinite(rawManualSceneCount)
    ? Math.floor(rawManualSceneCount)
    : undefined;
  const hasManualSceneCount = typeof manualSceneCount === 'number' && manualSceneCount > 6;
  const durationSceneMapping: Record<number, number> = {
    15: 3,
    20: 4,
    25: 5,
    30: 6,
    60: 6,
  };
  const inferredSceneCount = hasTargetDuration
    ? (durationSceneMapping[targetDurationSec] ?? Math.max(3, Math.min(6, Math.round(targetDurationSec / 5))))
    : undefined;
  const targetSceneCount = hasManualSceneCount
    ? Math.min(20, manualSceneCount)
    : inferredSceneCount;
  const avgSceneDurationSec = hasTargetDuration && targetSceneCount
    ? Number((targetDurationSec / targetSceneCount).toFixed(1))
    : undefined;
  const targetDurationGuideline = hasTargetDuration && targetSceneCount
    ? `目標影片長度 ${targetDurationSec} 秒，優先產出 ${targetSceneCount} 場；平均每場約 ${avgSceneDurationSec} 秒。`
    : '以 4-6 場景為目標，優先可製作性。';
  const targetDurationSecondPassRule = hasTargetDuration && targetSceneCount
    ? `保持約 ${targetSceneCount} 場（總長約 ${targetDurationSec} 秒，平均每場約 ${avgSceneDurationSec} 秒），除非原本不足，否則不要大幅增減。`
    : '保持 4-6 場景，除非原本不足，否則不要大幅增減。';
  const normalizedSceneLimit = targetSceneCount ?? 6;

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
    const referenceCanonicalTagMap = new Map<string, string>();
    (references || []).forEach((reference) => {
      if (!reference.name || typeof reference.name !== 'string') return;
      const normalized = normalizeTag(reference.name);
      if (normalized) {
        referenceCanonicalTagMap.set(normalized, `<${reference.name.trim()}>`);
      }
    });
    const normalizeStringArray = (value: unknown) => Array.isArray(value)
      ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
      : [];
    const toCanonicalTag = (value: string) => {
      const normalized = normalizeTag(value);
      if (!normalized) return '';
      return referenceCanonicalTagMap.get(normalized) || `<${value.replace(/^<|>$/g, '').trim()}>`;
    };
    const normalizeTaggedArray = (value: unknown) => {
      if (!Array.isArray(value)) return [];
      const result: string[] = [];
      const seen = new Set<string>();
      value.forEach((entry) => {
        if (typeof entry !== 'string') return;
        const canonical = toCanonicalTag(entry);
        if (!canonical) return;
        const normalized = normalizeTag(canonical);
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        result.push(canonical);
      });
      return result;
    };
    const normalizeEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => {
      const normalized = typeof value === 'string' ? value.trim() as T : fallback;
      return allowed.includes(normalized) ? normalized : fallback;
    };
    const normalizeSharedDirective = (value: unknown): SharedContinuityDirective | null => {
      if (!value || typeof value !== 'object') return null;
      const rawDirective = value as Record<string, unknown>;
      const anchorLabel = stringValue(rawDirective.anchorLabel);
      const directive = stringValue(rawDirective.directive);
      if (!anchorLabel || !directive) return null;
      const appliesToStages = normalizeStringArray(rawDirective.appliesToStages);
      return {
        anchorLabel,
        directive,
        appliesToStages: appliesToStages.length > 0 ? appliesToStages as SharedContinuityDirective['appliesToStages'] : undefined,
      };
    };
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
      const renderLane = normalizeEnum<RenderLane>(scene.renderLane, STORYBOARD_RENDER_LANES, 'hero');
      const productionRisk = normalizeEnum<ProductionRisk>(scene.productionRisk, STORYBOARD_PRODUCTION_RISKS, 'medium');
      const referencePriorityMode = normalizeEnum<ReferencePriorityMode>(scene.referencePriorityMode, STORYBOARD_REFERENCE_PRIORITY_MODES, 'stage_balanced');
      const viewIntent = normalizeEnum<ViewIntent>(scene.viewIntent, STORYBOARD_VIEW_INTENTS, 'auto');
      const normalizedCharactersUsed = normalizeTaggedArray(scene.charactersUsed);
      const normalizedProductsUsed = normalizeTaggedArray(scene.productsUsed);
      const normalizedHints: Record<string, ViewIntent> = {};
      for (const tag of [...normalizedCharactersUsed, ...normalizedProductsUsed]) {
        const canonicalTag = toCanonicalTag(tag);
        if (canonicalTag) normalizedHints[canonicalTag] = viewIntent;
      }
      if (scene.referenceViewHints && typeof scene.referenceViewHints === 'object') {
        for (const [key, value] of Object.entries(scene.referenceViewHints)) {
          if (typeof value !== 'string') continue;
          if (!(STORYBOARD_VIEW_INTENTS as readonly string[]).includes(value)) continue;
          const canonicalTag = toCanonicalTag(key);
          if (canonicalTag) normalizedHints[canonicalTag] = value as ViewIntent;
        }
      }
      const normalizedRequiredReferences = normalizeTaggedArray(scene.requiredReferences);
      const normalizedReferencePlan = getSceneReferencePlan({
        referencePlan: Array.isArray(scene.referencePlan) ? scene.referencePlan as Scene['referencePlan'] : [],
        referenceViewHints: normalizedHints,
        viewIntent,
        requiredReferences: normalizedRequiredReferences,
        charactersUsed: normalizedCharactersUsed,
        productsUsed: normalizedProductsUsed,
      }, references);
      const parsedHookScore = Number(scene.hookScore);
      const hookScore: NonNullable<Scene['hookScore']> = ([1, 2, 3, 4, 5] as const).includes(parsedHookScore as 1 | 2 | 3 | 4 | 5)
        ? parsedHookScore as NonNullable<Scene['hookScore']>
        : (index === 0 ? 4 : 3);
      const retentionRisk = normalizeEnum<NonNullable<Scene['retentionRisk']>>(
        scene.retentionRisk,
        ['low', 'medium', 'high'] as const,
        hookScore >= 4 ? 'low' : 'medium'
      );
      const hookScoreReason = stringValue(scene.hookScoreReason)
        || (index === 0
          ? '首場需承擔開場 Hook，因此預設要求高辨識度主體、單一焦點與明確懸念。'
          : '此鏡依敘事任務承接前後段落，Hook 以資訊推進與節奏變化為主。');

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
        viewIntent,
        referenceViewHints: normalizedHints,
        referencePlan: normalizedReferencePlan,
        renderLane,
        productionRisk,
        reservedForPost: stringValue(scene.reservedForPost),
        deliveryIntent: stringValue(scene.deliveryIntent),
        referencePriorityMode,
        hookScore,
        hookScoreReason,
        retentionRisk,
        requiredReferences: normalizedRequiredReferences,
        charactersUsed: normalizedCharactersUsed,
        productsUsed: normalizedProductsUsed,
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
      sharedAnchors: normalizeStringArray(raw.sharedAnchors),
      sharedContinuityDirectives: Array.isArray(raw.sharedContinuityDirectives)
        ? raw.sharedContinuityDirectives.map(normalizeSharedDirective).filter((v): v is SharedContinuityDirective => v !== null)
        : [],
      scenes: normalizedScenes,
    };
  };

  const model = config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  const responseSchema = template.outputSchema as OpenRouterJsonSchema;
  const callJsonCompletion = (messages: OpenRouterMessage[]) =>
    callOpenRouterJson<unknown>({
      apiKey: config.apiKey,
      model,
      messages,
      schemaName: 'storyboard_generation_response',
      schema: responseSchema,
    });

  // 使用 prompt builder 構建包含參考圖資訊的系統提示詞
  const systemPrompt = buildSystemPrompt(template, references);
  const outputSchemaText = JSON.stringify(template.outputSchema, null, 2);
  const firstPassParsed = await callJsonCompletion([
    {
      role: 'system',
      content: `${systemPrompt}\n\n${STORYBOARD_CONTRACT_PROMPT_BLOCK}\n你必須以 JSON 格式回應，遵循以下結構：${outputSchemaText}`,
    },
    {
      role: 'user',
      content: `${userPrompt}

補充要求：
- ${targetDurationGuideline}
- ${hasManualSceneCount ? `使用者指定目標場景數為 ${targetSceneCount} 場；請優先遵守。` : '若需超過 6 場，必須由使用者明確指定；否則維持 6 場內。'}
- 角色與商品外觀一致性高於創意發散。
- requiresEndFrame 採保守判斷，非必要不要設 true。
- 只輸出 JSON，不要包含其他文字。`,
    },
  ]);

  console.log('第一輪分鏡回應（前 200 字）:', JSON.stringify(firstPassParsed).substring(0, 200));

  const secondPassSystemPrompt = `你是分鏡腳本品質審核器。請修正既有 JSON，不要改變原始企劃核心。

修正優先順序：
1) 轉場合理性（與前後場景語義一致）
2) requiresEndFrame / endFrameDescription 邏輯一致
3) 角色與商品一致性（不可改變核心外觀）
4) 開場吸引力與整體留存節奏

規則：
- ${targetDurationSecondPassRule}
- ${hasManualSceneCount ? `場景數需維持在 ${targetSceneCount} 場（使用者指定）。` : '未收到使用者指定時，不得自動擴張到超過 6 場。'}
- 若 transitionToNext.type = "continuation"，requiresEndFrame 可為 true 或 false；若為 false，需保持 endFrameDescription/endFrameDelta 為空字串。
- 若 requiresEndFrame = false，endFrameDescription 必須是空字串 ""。
- 若 requiresEndFrame = false，endFrameDelta 也必須是空字串 ""。
- 頂層必須有 sharedAnchors/sharedContinuityDirectives，沒有內容時也要輸出空陣列。
- 每個場景都要有 sceneIntent/startComposition/subjectMotion/continuityLock。
- 每個場景都要有 shotIntent/continuityAnchor/requiredReferences/referencePlan（若無必用參考則 requiredReferences=[]；若無角色/商品則 referencePlan=[]）。
- 每個場景都要有 renderLane/productionRisk/reservedForPost/deliveryIntent/referencePriorityMode。
- 每個場景都要有 hookScore/hookScoreReason/retentionRisk。
- endFrameDelta 必須用「相對首幀差異」描述，不可重寫整個場景。
- 若 description 內使用 <角色>/<商品> 標記，charactersUsed/productsUsed 必須同步列出。
- 不可在 description 重新定義角色/商品外觀（髮型、服裝、顏色、材質、Logo 細節）。
- 若某角色/商品使用 side/back/three_quarter/top 視角，referencePlan 應明寫 requestedView，並在 visibleFeatures 或 description 中說清楚該視角可見特徵。
- 第一場 hookScore 若低於 4，請優先重寫第一場，使其具備可當縮圖的單一焦點與清楚懸念。
- 不可讓相鄰兩場都只做中性鋪陳；中段至少保留一個 escalation / twist / reveal；最後一場需有 payoff、CTA 或可分享瞬間。
- 只輸出 JSON。`;

  let finalParsed: unknown = firstPassParsed;
  try {
    const violations = buildConsistencyViolations(firstPassParsed);
    finalParsed = await callJsonCompletion([
      {
        role: 'system',
        content: `${secondPassSystemPrompt}\n\n${STORYBOARD_CONTRACT_PROMPT_BLOCK}\n請遵循以下 JSON 結構：${outputSchemaText}`,
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
    console.log('第二輪修正回應（前 200 字）:', JSON.stringify(finalParsed).substring(0, 200));
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
      shotIntent: { type: 'string' },
      continuityAnchor: { type: 'string' },
      viewIntent: { type: 'string', enum: [...STORYBOARD_VIEW_INTENTS] },
      referenceViewHints: {
        type: 'object',
        additionalProperties: { type: 'string', enum: [...STORYBOARD_VIEW_INTENTS] },
      },
      referencePlan: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tag: { type: 'string' },
            entityType: { type: 'string', enum: ['character', 'product'] },
            requestedView: { type: 'string', enum: [...STORYBOARD_VIEW_INTENTS] },
            required: { type: 'boolean' },
            visibleFeatures: { type: 'string' },
          },
          required: ['tag', 'requestedView', 'required'],
        },
      },
      renderLane: { type: 'string', enum: [...STORYBOARD_RENDER_LANES] },
      productionRisk: { type: 'string', enum: [...STORYBOARD_PRODUCTION_RISKS] },
      reservedForPost: { type: 'string' },
      deliveryIntent: { type: 'string' },
      referencePriorityMode: { type: 'string', enum: [...STORYBOARD_REFERENCE_PRIORITY_MODES] },
      hookScore: { type: 'integer', enum: [1, 2, 3, 4, 5] },
      hookScoreReason: { type: 'string' },
      retentionRisk: { type: 'string', enum: ['low', 'medium', 'high'] },
      requiresEndFrame: { type: 'boolean' },
      endFrameDescription: { type: 'string' },
      endFrameDelta: { type: 'string' },
      endFrameDeltaSpec: {
        type: 'object',
        properties: {
          reframingGoal: { type: 'string' },
          subjectScaleChangePct: { type: 'string' },
          newVisibleArea: { type: 'string' },
          mustNotChange: { type: 'array', items: { type: 'string' } },
        },
      },
      dialogue: { type: 'string' },
      duration: { type: 'number' },
      notes: { type: 'string' },
      requiredReferences: { type: 'array', items: { type: 'string' } },
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
    required: ['sceneNumber', 'description', 'cameraMovement', 'sceneIntent', 'startComposition', 'subjectMotion', 'continuityLock', 'shotIntent', 'continuityAnchor', 'viewIntent', 'referenceViewHints', 'referencePlan', 'renderLane', 'productionRisk', 'reservedForPost', 'deliveryIntent', 'referencePriorityMode', 'hookScore', 'hookScoreReason', 'retentionRisk', 'requiresEndFrame', 'endFrameDelta', 'dialogue', 'duration', 'requiredReferences', 'charactersUsed', 'productsUsed', 'changeFromPrev', 'transitionToNext'],
  };

  const parsed = await callOpenRouterJson<{ scene?: Partial<Scene> }>({
    apiKey: config.apiKey,
    model,
    schemaName: 'storyboard_scene_regeneration',
    schema: {
      type: 'object',
      properties: {
        scene: sceneSchema,
      },
      required: ['scene'],
    },
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
- scene 必須保留完整 contract，特別是 renderLane / productionRisk / reservedForPost / deliveryIntent / referencePriorityMode / hookScore / hookScoreReason / retentionRisk。
- scene 必須保留完整視角 contract，特別是 viewIntent / referenceViewHints / referencePlan / requiredReferences；若場景有多視角參考，請明確標記每個主體要用哪個視角與可見特徵。
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
  });
  if (!parsed.scene) throw new Error('回傳缺少 scene');
  return parsed.scene;
}

/**
 * 分析參考圖片
 */
/**
 * Multi-image vision call. First URL is the subject image, the rest are
 * reference images aligned with the prompt. All images should be fetchable
 * URLs or data URIs.
 */
export async function callVisionMulti(
  imageUrls: string[],
  prompt: string,
  config: OpenRouterConfig & { model?: string }
): Promise<{ content: string; model: string }> {
  const model = config.model || process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-001';
  const imageContent = imageUrls
    .filter((url) => typeof url === 'string' && url.trim())
    .map((url) => ({ type: 'image_url' as const, image_url: { url } }));

  if (imageContent.length === 0) {
    throw new Error('callVisionMulti requires at least one image URL');
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': getAppOrigin(),
      'X-Title': 'Storyboard System',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageContent,
          ],
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
    throw new Error(`OpenRouter vision error (${response.status}): ${errorDetails}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter vision 沒有回傳內容');
  }
  return { content, model };
}

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
      'HTTP-Referer': getAppOrigin(),
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

  const parsed = await callOpenRouterJson<Partial<CharacterProfileGenerationResult>>({
    apiKey: config.apiKey,
    model,
    schemaName: 'character_profile_generation',
    schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        guidelines: { type: 'string' },
      },
      required: ['description', 'guidelines'],
    },
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
  });

  return {
    description: (parsed.description || '').trim(),
    guidelines: (parsed.guidelines || '').trim(),
  };
}

/**
 * 評估分鏡腳本的廣告創意效果
 */
export async function reviewStoryboardCreativity(
  scenes: Scene[],
  config: OpenRouterConfig
): Promise<CreativeReview> {
  const model = config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

  const systemPrompt = `你是資深廣告導演，專精於分析短影片的 Hook 強度與觀眾留存率。

請以廣告導演角色評估每個場景的廣告效果，輸出 JSON 格式評估報告。

評估維度：
- hookScore (1-5): 1=完全沒有 Hook/觀眾會立刻滑走，5=極強 Hook/幾乎必看
- retentionRisk: low=觀眾會繼續看，medium=可能流失，high=幾乎確定會離開
- weakPoint: 此場景最大弱點（一句話）
- suggestion: 改善建議（具體可執行）

整體評估：
- emotionalArc: 情感弧線描述（好奇→認識→慾望→行動 或其他）
- pacing: 節奏評估（太慢/合適/太快）
- strongestScene: 最強場景編號（整數）
- weakestScene: 最弱場景編號（整數）

只輸出 JSON，不要其他文字。`;

  const parsed = await callOpenRouterJson<Partial<CreativeReview>>({
    apiKey: config.apiKey,
    model,
    schemaName: 'creative_review',
    schema: {
      type: 'object',
      properties: {
        emotionalArc: { type: 'string' },
        pacing: { type: 'string' },
        strongestScene: { type: 'integer' },
        weakestScene: { type: 'integer' },
        sceneReviews: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sceneNumber: { type: 'integer' },
              hookScore: { type: 'number' },
              hookScoreReason: { type: 'string' },
              retentionRisk: { type: 'string' },
              weakPoint: { type: 'string' },
              suggestion: { type: 'string' },
            },
            required: ['sceneNumber', 'hookScore', 'retentionRisk', 'weakPoint', 'suggestion'],
          },
        },
      },
      required: ['emotionalArc', 'pacing', 'strongestScene', 'weakestScene', 'sceneReviews'],
    },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `請評估以下分鏡腳本的廣告效果：\n${JSON.stringify(
          scenes.map(s => ({
            sceneNumber: s.sceneNumber,
            description: s.description,
            cameraMovement: s.cameraMovement,
            dialogue: s.dialogue,
            duration: s.duration,
            sceneIntent: s.sceneIntent,
            notes: s.notes,
          })),
          null,
          2
        )}\n\n請輸出 JSON：{"emotionalArc":"...","pacing":"...","strongestScene":1,"weakestScene":3,"sceneReviews":[{"sceneNumber":1,"hookScore":4,"hookScoreReason":"...","retentionRisk":"low","weakPoint":"...","suggestion":"..."}]}`,
      },
    ],
  });

  return {
    emotionalArc: parsed.emotionalArc || '',
    pacing: parsed.pacing || '',
    strongestScene: Number(parsed.strongestScene) || 1,
    weakestScene: Number(parsed.weakestScene) || 1,
    sceneReviews: Array.isArray(parsed.sceneReviews) ? parsed.sceneReviews : [],
  };
}

/**
 * 生成三種 Hook 變體場景
 */
export async function generateHookVariants(
  topic: string,
  references: string,
  existingScene1: Partial<Scene>,
  config: OpenRouterConfig
): Promise<HookVariant[]> {
  const model = config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

  const systemPrompt = `你是廣告創意導演，專精於短影片開場設計。

請生成 3 種截然不同的 Hook 開場風格（Scene 1 的替代方案）：
1. Shock Hook（震驚型）：視覺或資訊衝擊，讓觀眾無法滑走
2. Question Hook（問題型）：製造強力懸念，觀眾必須繼續看才知道答案
3. Story Hook（故事型）：「我一直以為...直到...」的個人敘事起點

每種變體必須包含完整的 scene 物件，包含：
- description, cameraMovement, sceneIntent, dialogue, duration, notes
- notes 必須包含 [HOOK: type] 標記

只輸出 JSON，格式：
{"variants":[
  {"variantType":"shock","variantLabel":"震驚型開場","scene":{...}},
  {"variantType":"question","variantLabel":"懸念問題型","scene":{...}},
  {"variantType":"story","variantLabel":"故事敘事型","scene":{...}}
]}`;

  const parsed = await callOpenRouterJson<{ variants?: HookVariant[] }>({
    apiKey: config.apiKey,
    model,
    schemaName: 'hook_variants',
    schema: {
      type: 'object',
      properties: {
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              variantType: { type: 'string' },
              variantLabel: { type: 'string' },
              scene: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  cameraMovement: { type: 'string' },
                  sceneIntent: { type: 'string' },
                  dialogue: { type: 'string' },
                  duration: { type: 'number' },
                  notes: { type: 'string' },
                },
                required: ['description', 'cameraMovement', 'sceneIntent', 'dialogue', 'duration', 'notes'],
              },
            },
            required: ['variantType', 'variantLabel', 'scene'],
          },
        },
      },
      required: ['variants'],
    },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `主題：${topic}\n參考資料：${references}\n\n現有場景 1（請以此為基礎創作 3 種替代 Hook）：\n${JSON.stringify(existingScene1, null, 2)}\n\n請生成 3 種不同 Hook 風格的替代開場。`,
      },
    ],
  });

  return Array.isArray(parsed.variants) ? parsed.variants : [];
}

export interface IndexTtsPlanningInput {
  storyboardTitle?: string;
  originalPrompt?: string;
  voiceDirection?: string;
  audioUrl: string;
  emotionalAudioUrl?: string;
  scenes: IndexTtsScenePlanningInput[];
}

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

const EMOTION_ALIASES: Record<
  keyof Pick<IndexTtsEmotionalStrengths, 'happy' | 'angry' | 'sad' | 'afraid' | 'disgusted' | 'melancholic' | 'surprised' | 'calm'>,
  string[]
> = {
  happy: ['happy', 'happiness'],
  angry: ['angry', 'anger'],
  sad: ['sad', 'sadness'],
  afraid: ['afraid', 'fear'],
  disgusted: ['disgusted', 'disgust'],
  melancholic: ['melancholic'],
  surprised: ['surprised', 'surprise'],
  calm: ['calm', 'neutral'],
};

function normalizeEmotionStrengths(value: unknown): IndexTtsEmotionalStrengths | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const normalized: IndexTtsEmotionalStrengths = {};

  for (const [canonicalKey, aliases] of Object.entries(EMOTION_ALIASES) as Array<[keyof typeof EMOTION_ALIASES, string[]]>) {
    const num = aliases
      .map((alias) => clampNumber(raw[alias], 0, 1))
      .find((value): value is number => typeof value === 'number');
    if (typeof num === 'number') normalized[canonicalKey] = num;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export async function planIndexTtsVoiceovers(
  input: IndexTtsPlanningInput,
  config: OpenRouterConfig
): Promise<IndexTtsScenePlan[]> {
  const model = config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  const audioUrl = input.audioUrl.trim();
  const emotionalAudioUrl = input.emotionalAudioUrl?.trim() || '';
  const scenes = input.scenes
    .map((scene) => ({
      ...scene,
      sourceText: scene.sourceText.trim(),
    }))
    .filter((scene) => Boolean(scene.sourceText));

  if (!audioUrl) {
    throw new Error('audioUrl is required for Index TTS planning');
  }
  if (scenes.length === 0) return [];

  const systemPrompt = `你是專業語音導演，負責把分鏡文字轉為 fal-ai/index-tts-2 旁白參數。

目標：
1) 每個場景輸出可直接送出 TTS 的 payload。
2) 旁白語氣需貼合場景情緒與鏡頭節奏。
3) 文案長度要能大致對齊場景秒數，不要冗長。
4) 每個場景都先做「direction 規劃」，再落地成 prompt。

輸出限制：
- 只輸出 JSON，不要額外文字。
- JSON 格式：
{
  "plans": [
    {
      "sceneId": "string",
      "sceneNumber": 1,
      "prompt": "旁白內容",
      "strength": 0.9,
      "should_use_prompt_for_emotion": true,
      "emotion_prompt": "語氣指令",
      "emotional_strengths": {
        "happy": 0.2,
        "angry": 0.0,
        "sad": 0.0,
        "afraid": 0.0,
        "disgusted": 0.0,
        "melancholic": 0.0,
        "surprised": 0.1,
        "calm": 0.7
      },
      "direction": {
        "tone": "溫暖、可信任",
        "pace": "中速、每句 2-3 秒",
        "emphasis": "強調產品利益與轉場關鍵詞",
        "avoid": "避免口號腔與過度誇張"
      },
      "reasoning": "一句話說明"
    }
  ]
}

欄位規則：
- prompt：必填，輸出最終要朗讀的文字（自然語句，不要標題、不要項目符號）。
- strength：0.0~1.0，可省略。
- emotion_prompt 與 should_use_prompt_for_emotion 可一起使用。
- emotional_strengths 各值 0.0~1.0，可省略。
- direction：可選，但若提供需具體且可執行（tone / pace / emphasis / avoid）。
- 可同時提供 emotion_prompt 與 emotional_strengths；若衝突，以 emotion_prompt 為主。`;

  const parsed = await callOpenRouterJson<{ plans?: Array<Record<string, unknown>> }>({
    apiKey: config.apiKey,
    model,
    schemaName: 'index_tts_planning',
    schema: {
      type: 'object',
      properties: {
        plans: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sceneId: { type: 'string' },
              sceneNumber: { type: 'integer' },
              prompt: { type: 'string' },
              strength: { type: 'number' },
              should_use_prompt_for_emotion: { type: 'boolean' },
              emotion_prompt: { type: 'string' },
              emotional_strengths: {
                type: 'object',
                properties: {
                  happy: { type: 'number' },
                  angry: { type: 'number' },
                  sad: { type: 'number' },
                  afraid: { type: 'number' },
                  disgusted: { type: 'number' },
                  melancholic: { type: 'number' },
                  surprised: { type: 'number' },
                  calm: { type: 'number' },
                },
              },
              direction: {
                type: 'object',
                properties: {
                  tone: { type: 'string' },
                  pace: { type: 'string' },
                  emphasis: { type: 'string' },
                  avoid: { type: 'string' },
                },
              },
              reasoning: { type: 'string' },
            },
            required: ['sceneId', 'sceneNumber', 'prompt'],
          },
        },
      },
      required: ['plans'],
    },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify({
          storyboardTitle: input.storyboardTitle || '',
          originalPrompt: input.originalPrompt || '',
          voiceDirection: input.voiceDirection || '',
          audioRequirements: {
            provider: 'fal-ai/index-tts-2',
            audio_url: audioUrl,
            emotional_audio_url: emotionalAudioUrl || undefined,
          },
          scenes: scenes.map((scene) => ({
            sceneId: scene.sceneId,
            sceneNumber: scene.sceneNumber,
            duration: scene.duration,
            sourceLabel: scene.sourceLabel,
            sourceText: scene.sourceText,
            description: scene.description || '',
            dialogue: scene.dialogue || '',
            notes: scene.notes || '',
          })),
        }),
      },
    ],
  });

  const rawPlans = Array.isArray(parsed.plans) ? parsed.plans : [];
  const bySceneId = new Map<string, Record<string, unknown>>();
  const bySceneNumber = new Map<number, Record<string, unknown>>();
  for (const rawPlan of rawPlans) {
    const sceneId = typeof rawPlan.sceneId === 'string' ? rawPlan.sceneId.trim() : '';
    const sceneNumber = Number(rawPlan.sceneNumber);
    if (sceneId) bySceneId.set(sceneId, rawPlan);
    if (Number.isFinite(sceneNumber)) bySceneNumber.set(sceneNumber, rawPlan);
  }

  const normalizedPlans: IndexTtsScenePlan[] = scenes.map((scene) => {
    const rawPlan = bySceneId.get(scene.sceneId) || bySceneNumber.get(scene.sceneNumber) || {};
    const prompt = typeof rawPlan.prompt === 'string' && rawPlan.prompt.trim()
      ? rawPlan.prompt.trim()
      : scene.sourceText;

    const strength = clampNumber(rawPlan.strength, 0, 1);
    const emotionalStrengths = normalizeEmotionStrengths(rawPlan.emotional_strengths);
    const rawEmotionPrompt = typeof rawPlan.emotion_prompt === 'string' ? rawPlan.emotion_prompt.trim() : '';
    let shouldUsePromptForEmotion = typeof rawPlan.should_use_prompt_for_emotion === 'boolean'
      ? rawPlan.should_use_prompt_for_emotion
      : undefined;

    if (rawEmotionPrompt && shouldUsePromptForEmotion !== true) {
      shouldUsePromptForEmotion = true;
    }

    const payload: IndexTtsRequestInput = {
      audio_url: audioUrl,
      prompt,
    };
    if (emotionalAudioUrl) payload.emotional_audio_url = emotionalAudioUrl;
    if (typeof strength === 'number') payload.strength = strength;
    if (emotionalStrengths) payload.emotional_strengths = emotionalStrengths;
    if (typeof shouldUsePromptForEmotion === 'boolean') {
      payload.should_use_prompt_for_emotion = shouldUsePromptForEmotion;
    }
    if (rawEmotionPrompt) payload.emotion_prompt = rawEmotionPrompt;

    const rawDirection = rawPlan.direction && typeof rawPlan.direction === 'object'
      ? rawPlan.direction as Record<string, unknown>
      : undefined;
    const directionSummary = rawDirection
      ? [
        typeof rawDirection.tone === 'string' && rawDirection.tone.trim()
          ? `tone=${rawDirection.tone.trim()}`
          : '',
        typeof rawDirection.pace === 'string' && rawDirection.pace.trim()
          ? `pace=${rawDirection.pace.trim()}`
          : '',
        typeof rawDirection.emphasis === 'string' && rawDirection.emphasis.trim()
          ? `emphasis=${rawDirection.emphasis.trim()}`
          : '',
        typeof rawDirection.avoid === 'string' && rawDirection.avoid.trim()
          ? `avoid=${rawDirection.avoid.trim()}`
          : '',
      ].filter(Boolean).join('; ')
      : '';
    const rawReasoning = typeof rawPlan.reasoning === 'string' ? rawPlan.reasoning.trim() : '';
    const combinedReasoning = [rawReasoning, directionSummary]
      .filter(Boolean)
      .join(' | ');

    return {
      sceneId: scene.sceneId,
      sceneNumber: scene.sceneNumber,
      sourceLabel: scene.sourceLabel,
      sourceText: scene.sourceText,
      payload,
      reasoning: combinedReasoning || undefined,
    };
  });

  return normalizedPlans;
}

export interface ElevenLabsMusicPromptIdeasInput {
  storyboardTitle?: string;
  originalPrompt?: string;
  currentPrompt?: string;
  targetDurationSec?: number;
  scenes: Array<{
    sceneNumber: number;
    duration: number;
    description?: string;
    dialogue?: string;
    notes?: string;
    cameraMovement?: string;
  }>;
}

export async function suggestElevenLabsMusicPrompts(
  input: ElevenLabsMusicPromptIdeasInput,
  config: OpenRouterConfig
): Promise<ElevenLabsMusicPromptIdea[]> {
  const model = config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
  const scenes = input.scenes.filter((scene) => Number.isFinite(scene.sceneNumber) && Number.isFinite(scene.duration));
  if (scenes.length === 0) return [];

  const systemPrompt = `你是商業短影片配樂導演，專門撰寫 fal-ai/elevenlabs/music 的高品質提示詞。

目標：
1) 根據分鏡內容提出 3 組不同風格方向的音樂提示詞。
2) 每組提示詞都要可直接貼進 ElevenLabs Music 生成。
3) 音樂要支撐敘事節奏，避免搶戲。
4) 先定義 direction（節奏/配器/避雷），再寫最終 prompt。

輸出限制：
- 只輸出 JSON，不要其他文字。
- JSON 格式：
{
  "ideas": [
    {
      "prompt": "string",
      "reasoning": "string",
      "mood": "string",
      "energy": "low|medium|high",
      "direction": {
        "tempo": "slow|mid|fast + bpm range",
        "instrumentation": "主樂器與層次",
        "mixFocus": "人聲/旁白避讓與頻段策略",
        "avoid": "禁止元素（例如 heavy drums / vocals）"
      }
    }
  ]
}

提示詞規範：
- 以英文撰寫 prompt（更利於 music model 解讀），1-2 句自然語言。
- 避免品牌名、歌詞內容、具體歌手名字。
- 可包含：genre, instrumentation, tempo, emotional arc, mix style, no vocals / sparse vocals。
- 不要關鍵字堆疊，不要用逗號長串。`;

  const parsed = await callOpenRouterJson<{ ideas?: Array<Record<string, unknown>> }>({
    apiKey: config.apiKey,
    model,
    schemaName: 'elevenlabs_music_prompt_ideas',
    schema: {
      type: 'object',
      properties: {
        ideas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              reasoning: { type: 'string' },
              mood: { type: 'string' },
              energy: { type: 'string', enum: ['low', 'medium', 'high'] },
              direction: {
                type: 'object',
                properties: {
                  tempo: { type: 'string' },
                  instrumentation: { type: 'string' },
                  mixFocus: { type: 'string' },
                  avoid: { type: 'string' },
                },
              },
            },
            required: ['prompt'],
          },
        },
      },
      required: ['ideas'],
    },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: JSON.stringify({
          provider: 'fal-ai/elevenlabs/music',
          storyboardTitle: input.storyboardTitle || '',
          originalPrompt: input.originalPrompt || '',
          currentPrompt: input.currentPrompt || '',
          targetDurationSec: input.targetDurationSec,
          scenes: scenes.map((scene) => ({
            sceneNumber: scene.sceneNumber,
            duration: scene.duration,
            description: scene.description || '',
            dialogue: scene.dialogue || '',
            notes: scene.notes || '',
            cameraMovement: scene.cameraMovement || '',
          })),
        }),
      },
    ],
  });

  const ideasRaw = Array.isArray(parsed.ideas) ? parsed.ideas : [];
  const ideas = ideasRaw
    .map((item) => {
      const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : '';
      if (!prompt) return null;
      const energyRaw = typeof item.energy === 'string' ? item.energy.trim().toLowerCase() : '';
      const energy = energyRaw === 'low' || energyRaw === 'medium' || energyRaw === 'high'
        ? energyRaw
        : undefined;
      const rawDirection = item.direction && typeof item.direction === 'object'
        ? item.direction as Record<string, unknown>
        : undefined;
      const directionSummary = rawDirection
        ? [
          typeof rawDirection.tempo === 'string' && rawDirection.tempo.trim()
            ? `tempo=${rawDirection.tempo.trim()}`
            : '',
          typeof rawDirection.instrumentation === 'string' && rawDirection.instrumentation.trim()
            ? `instrumentation=${rawDirection.instrumentation.trim()}`
            : '',
          typeof rawDirection.mixFocus === 'string' && rawDirection.mixFocus.trim()
            ? `mix=${rawDirection.mixFocus.trim()}`
            : '',
          typeof rawDirection.avoid === 'string' && rawDirection.avoid.trim()
            ? `avoid=${rawDirection.avoid.trim()}`
            : '',
        ].filter(Boolean).join('; ')
        : '';
      const reasoning = [
        typeof item.reasoning === 'string' ? item.reasoning.trim() : '',
        directionSummary,
      ].filter(Boolean).join(' | ');
      return {
        prompt,
        reasoning: reasoning || undefined,
        mood: typeof item.mood === 'string' ? item.mood.trim() : undefined,
        energy,
      } as ElevenLabsMusicPromptIdea;
    })
    .filter((item): item is ElevenLabsMusicPromptIdea => item !== null)
    .slice(0, 3);

  if (ideas.length > 0) return ideas;

  const fallbackPrompt = (input.currentPrompt || '').trim();
  return fallbackPrompt
    ? [{ prompt: fallbackPrompt, reasoning: '沿用現有提示詞（AI 未回傳有效新提案）' }]
    : [];
}
