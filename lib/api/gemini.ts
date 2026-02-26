import { GoogleGenAI, Type } from '@google/genai';
import type { Storyboard, Scene, ProjectReference } from '../types/storyboard';
import { EditingSuggestion } from '../types/project';
import { buildConsolidatedReferenceRules } from '@/lib/references/consistency-rules';
import { buildIdentityLockPromptLine, buildStructuredIdentityLock } from '@/lib/references/identity-lock';

export interface GeminiConfig {
  apiKey: string;
}

export interface UploadedFile {
  name: string;
  uri: string;
  mimeType: string;
  sizeBytes?: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

export interface ComposeVideoPromptInput {
  model: 'kling' | 'seedance';
  scene: Pick<Scene, 'id' | 'sceneNumber' | 'description' | 'cameraMovement' | 'sceneIntent' | 'startComposition' | 'subjectMotion' | 'continuityLock' | 'shotIntent' | 'continuityAnchor' | 'changeFromPrev' | 'requiresEndFrame' | 'endFrameDescription'>;
  motionPrompt: string;
  references: ProjectReference[];
  hasPreviousEndFrame?: boolean;
}

export interface ComposeVideoPromptResult {
  composedPrompt: string;
  suggestedMotionPrompt?: string;
  notes?: string;
  sourceModel: string;
}

export interface ComposeImagePromptInput {
  scene: Pick<Scene, 'id' | 'sceneNumber' | 'description' | 'cameraMovement' | 'sceneIntent' | 'startComposition' | 'subjectMotion' | 'continuityLock' | 'requiresEndFrame' | 'endFrameDescription' | 'endFrameDelta' | 'beatGoal' | 'shotIntent' | 'continuityAnchor' | 'changeFromPrev'>;
  manualEndFrameDescription?: string;
  references: ProjectReference[];
  stylePrompt?: string;
  negativePrompt?: string;
  hasPreviousEndFrame?: boolean;
  startFramePrompt?: string;
  previousSceneDescription?: string;
  nextSceneDescription?: string;
}

export interface ComposeImagePromptResult {
  suggestedEndFrameDescription: string;
  composedPrompt: string;
  notes?: string;
  sourceModel: string;
}

const VIDEO_PROMPT_COMPOSER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    composedPrompt: { type: Type.STRING },
    suggestedMotionPrompt: { type: Type.STRING },
    notes: { type: Type.STRING },
  },
  required: ['composedPrompt'],
};

const IMAGE_PROMPT_COMPOSER_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    suggestedEndFrameDescription: { type: Type.STRING },
    composedPrompt: { type: Type.STRING },
    notes: { type: Type.STRING },
  },
  required: ['suggestedEndFrameDescription', 'composedPrompt'],
};

function parseGeminiJsonResponse<T extends Record<string, unknown>>(
  responseText: string,
  errorMessage: string
): T {
  const rawText = (responseText || '').trim();
  if (!rawText) throw new Error(errorMessage);

  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        throw new Error(errorMessage);
      }
    }
    throw new Error(errorMessage);
  }
}

// 上傳影片到 Gemini Files API
export async function uploadVideoToGemini(
  file: File,
  config: GeminiConfig
): Promise<UploadedFile> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });

  // 將 File 轉換為 Buffer (在 API Route 中)
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 建立臨時檔案
  const os = await import('os');
  const path = await import('path');
  const crypto = await import('crypto');
  const tempDir = os.tmpdir();
  const safeName = path.basename(file.name || 'video.mp4');
  const ext = path.extname(safeName) || '.mp4';
  const tempPath = path.join(tempDir, `gemini-upload-${crypto.randomUUID()}${ext}`);

  const fs = await import('fs/promises');
  try {
    await fs.writeFile(tempPath, buffer);

    // 使用新 SDK 的 files API
    const uploadResult = await ai.files.upload({
      file: tempPath,
      config: {
        mimeType: file.type,
        displayName: safeName,
      },
    });

    // 等待處理完成
    let uploadedFile = await ai.files.get({ name: uploadResult.name || '' });
    while (uploadedFile.state === 'PROCESSING') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      uploadedFile = await ai.files.get({ name: uploadResult.name || '' });
    }

    return {
      name: uploadedFile.name || '',
      uri: uploadedFile.uri || '',
      mimeType: uploadedFile.mimeType || file.type,
      sizeBytes: uploadedFile.sizeBytes?.toString(),
      state: uploadedFile.state as 'PROCESSING' | 'ACTIVE' | 'FAILED',
    };
  } finally {
    await fs.unlink(tempPath).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
        return;
      }
      throw error;
    });
  }
}

// 分析影片並生成剪輯建議
export async function analyzeVideosForEditing(
  uploadedFiles: UploadedFile[],
  storyboard: Storyboard,
  config: GeminiConfig
): Promise<EditingSuggestion> {
  try {
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // 構建影片內容參考
    const processedFiles = await Promise.all(uploadedFiles.map(async (file) => {
      // 如果是 Gemini URI 則直接使用
      if (file.uri.includes('generativelanguage.googleapis.com')) {
        return {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          }
        };
      }

      // 如果是外部 URL (如 Fal)，先下載並上傳到 Gemini
      console.log(`正在下載並上傳影片到 Gemini: ${file.name}`);
      try {
        const response = await fetch(file.uri);
        const arrayBuffer = await response.arrayBuffer();

        // 建立仿 File 物件以重用 uploadVideoToGemini
        const fileObj = {
          name: file.name,
          type: file.mimeType,
          arrayBuffer: async () => arrayBuffer
        } as unknown as File;

        const uploaded = await uploadVideoToGemini(fileObj, config);

        return {
          fileData: {
            mimeType: uploaded.mimeType,
            fileUri: uploaded.uri,
          }
        };
      } catch (error) {
        console.error(`處理影片失敗 ${file.name}:`, error);
        throw error;
      }
    }));

    const prompt = buildEditingAnalysisPrompt(storyboard, uploadedFiles);

    // 使用新 SDK 的 models API
    const result = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [
            ...processedFiles,
            { text: prompt }
          ]
        }
      ],
    });

    const responseText = result.text || '';
    return parseEditingSuggestion(responseText, storyboard);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    // 處理配額超限錯誤
    if (message.includes('quota') || message.includes('429')) {
      throw new Error(
        `Gemini API 配額已超限。建議解決方案：\\n` +
        `1. 在 .env.local 中將 GEMINI_MODEL 改為 gemini-2.5-flash-lite\\n` +
        `2. 或使用 gemini-2.5-flash (更高品質/較高成本)\\n` +
        `3. 或等待配額重置（通常為每日/每分鐘限制）\\n\\n` +
        `原始錯誤: ${message || 'Unknown error'}`
      );
    }

    // 其他錯誤直接拋出
    throw error;
  }
}

export async function composeVideoPromptWithGemini(
  input: ComposeVideoPromptInput,
  config: GeminiConfig
): Promise<ComposeVideoPromptResult> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const modelName = process.env.GEMINI_PROMPT_COMPOSER_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const consolidatedRules = buildConsolidatedReferenceRules(input.references || []);
  const referenceContext = consolidatedRules.map((rule) => {
    const lock = rule.structuredIdentityLock || buildStructuredIdentityLock({
      type: rule.type,
      identityCore: rule.identityCore,
      mustKeepFeatures: rule.mustKeepFeatures,
      guidelines: rule.guidelines.join('；'),
      description: '',
    });

    return {
      tag: rule.tag,
      identityCore: rule.identityCore || '',
      mustKeepFeatures: rule.mustKeepFeatures.slice(0, 8),
      guidelines: rule.guidelines.slice(0, 8),
      structuredLockLine: lock ? buildIdentityLockPromptLine(lock, rule.tag) : '',
    };
  });

  const modelSpecificRule = input.model === 'kling'
    ? '8) For Kling: prioritize physically plausible camera inertia and avoid sudden reframing leaps.'
    : '8) For Seedance: prioritize smooth temporal continuity across all frames and avoid frame flicker.'

  const systemPrompt = `You are a professional video prompt composer for ${input.model.toUpperCase()} image-to-video generation.
Return JSON only with keys:
{
  "composedPrompt": "string",
  "suggestedMotionPrompt": "string",
  "notes": "string"
}

Rules:
1) Compose one production-ready prompt from provided scene and reference constraints.
2) Keep camera language explicit (pan/dolly/tilt/zoom), avoid ambiguity.
3) Prioritize identity consistency: geometry/material/logo/text must remain unchanged.
4) If end frame is available, enforce end-state alignment. If not, avoid fake object motion.
5) Do not invent new logos/text/brand marks.
6) Keep output concise (prefer <= 2200 chars for kling, <= 3400 chars for seedance).
7) The composed prompt must describe one continuous shot only; never include cuts, montage, or scene switches.
${modelSpecificRule}
9) Avoid keyword stuffing like "masterpiece, best quality, 8k, ultra-detailed".
10) Respect storyboard directives: sceneIntent/startComposition/subjectMotion/continuityLock/shotIntent/continuityAnchor/changeFromPrev.
11) If visible text/logo exists, require exact spelling and placement. JSON only, no markdown.`;

  const userPayload = {
    mode: input.model,
    scene: {
      id: input.scene.id,
      sceneNumber: input.scene.sceneNumber,
      description: input.scene.description,
      cameraMovement: input.scene.cameraMovement,
      sceneIntent: input.scene.sceneIntent || '',
      startComposition: input.scene.startComposition || '',
      subjectMotion: input.scene.subjectMotion || '',
      continuityLock: input.scene.continuityLock || '',
      shotIntent: input.scene.shotIntent || '',
      continuityAnchor: input.scene.continuityAnchor || '',
      changeFromPrev: input.scene.changeFromPrev || '',
      requiresEndFrame: Boolean(input.scene.requiresEndFrame),
      endFrameDescription: input.scene.endFrameDescription || '',
      hasPreviousEndFrame: Boolean(input.hasPreviousEndFrame),
    },
    userMotionPrompt: input.motionPrompt,
    consolidatedReferenceRules: referenceContext,
  };

  const result = await ai.models.generateContent({
    model: modelName,
    config: {
      responseMimeType: 'application/json',
      responseSchema: VIDEO_PROMPT_COMPOSER_RESPONSE_SCHEMA,
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${systemPrompt}\n\nInput JSON:\n${JSON.stringify(userPayload, null, 2)}` },
        ],
      },
    ],
  });

  const parsed = parseGeminiJsonResponse<{
    composedPrompt?: string;
    suggestedMotionPrompt?: string;
    notes?: string;
  }>(result.text || '', 'Gemini 未回傳可用的 composedPrompt');

  const composedPrompt = parsed?.composedPrompt?.trim();
  if (!composedPrompt) {
    throw new Error('Gemini 未回傳可用的 composedPrompt');
  }

  return {
    composedPrompt,
    suggestedMotionPrompt: parsed?.suggestedMotionPrompt?.trim() || undefined,
    notes: parsed?.notes?.trim() || undefined,
    sourceModel: modelName,
  };
}

export async function composeImagePromptWithGemini(
  input: ComposeImagePromptInput,
  config: GeminiConfig
): Promise<ComposeImagePromptResult> {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const modelName = process.env.GEMINI_PROMPT_COMPOSER_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const consolidatedRules = buildConsolidatedReferenceRules(input.references || []);
  const referenceContext = consolidatedRules.map((rule) => {
    const lock = rule.structuredIdentityLock || buildStructuredIdentityLock({
      type: rule.type,
      identityCore: rule.identityCore,
      mustKeepFeatures: rule.mustKeepFeatures,
      guidelines: rule.guidelines.join('；'),
      description: '',
    });

    return {
      tag: rule.tag,
      identityCore: rule.identityCore || '',
      mustKeepFeatures: rule.mustKeepFeatures.slice(0, 8),
      guidelines: rule.guidelines.slice(0, 8),
      structuredLockLine: lock ? buildIdentityLockPromptLine(lock, rule.tag) : '',
    };
  });

  const systemPrompt = `You are an image prompt assistant for storyboard static frame generation.
Return JSON only with keys:
{
  "suggestedEndFrameDescription": "string",
  "composedPrompt": "string",
  "notes": "string"
}

Rules:
1) Generate a concise end-frame final-state description (no temporal language).
2) Infer terminal framing from cameraMovement, using startFramePrompt as continuity anchor.
3) If motion implies reframing (e.g., pan right to family), the end frame must reflect that final composition.
4) Generate endFrameDelta as delta-only instructions relative to start frame.
5) Keep identity/product geometry/logo/text constraints unchanged unless explicit delta says otherwise.
6) Do not invent new logos/text/characters/props.
7) Composed prompt must be for a single static frame only.
8) Treat stylePrompt as the primary creative direction; negativePrompt is guardrail only.
9) Preserve the original rendering medium from references (2D/3D/photoreal). Do not restyle medium unless explicitly requested.
10) For visible text/logo, explicitly specify exact wording and placement; if text is not required, explicitly forbid new text.
11) Avoid gibberish characters, corrupted typography, or accidental watermark-like marks.
12) Keep output concise and production-ready.
13) JSON only, no markdown.`;

  const userPayload = {
    scene: {
      id: input.scene.id,
      sceneNumber: input.scene.sceneNumber,
      description: input.scene.description,
      cameraMovement: input.scene.cameraMovement,
      sceneIntent: input.scene.sceneIntent || '',
      startComposition: input.scene.startComposition || '',
      subjectMotion: input.scene.subjectMotion || '',
      continuityLock: input.scene.continuityLock || '',
      beatGoal: input.scene.beatGoal || '',
      shotIntent: input.scene.shotIntent || '',
      continuityAnchor: input.scene.continuityAnchor || '',
      changeFromPrev: input.scene.changeFromPrev || '',
      requiresEndFrame: Boolean(input.scene.requiresEndFrame),
      endFrameDescription: input.scene.endFrameDescription || '',
      endFrameDelta: input.scene.endFrameDelta || '',
      manualEndFrameDescription: input.manualEndFrameDescription || '',
      hasPreviousEndFrame: Boolean(input.hasPreviousEndFrame),
    },
    context: {
      startFramePrompt: input.startFramePrompt || '',
      previousSceneDescription: input.previousSceneDescription || '',
      nextSceneDescription: input.nextSceneDescription || '',
    },
    style: {
      stylePrompt: input.stylePrompt || '',
      negativePrompt: input.negativePrompt || '',
    },
    consolidatedReferenceRules: referenceContext,
  };

  const result = await ai.models.generateContent({
    model: modelName,
    config: {
      responseMimeType: 'application/json',
      responseSchema: IMAGE_PROMPT_COMPOSER_RESPONSE_SCHEMA,
    },
    contents: [
      {
        role: 'user',
        parts: [
          { text: `${systemPrompt}\n\nInput JSON:\n${JSON.stringify(userPayload, null, 2)}` },
        ],
      },
    ],
  });

  const parsed = parseGeminiJsonResponse<{
    suggestedEndFrameDescription?: string;
    composedPrompt?: string;
    notes?: string;
  }>(result.text || '', 'Gemini 未回傳可用的 image compose 結果');

  const suggestedEndFrameDescription = parsed?.suggestedEndFrameDescription?.trim();
  const composedPrompt = parsed?.composedPrompt?.trim();

  if (!suggestedEndFrameDescription || !composedPrompt) {
    throw new Error('Gemini 未回傳可用的 image compose 結果');
  }

  return {
    suggestedEndFrameDescription,
    composedPrompt,
    notes: parsed?.notes?.trim() || undefined,
    sourceModel: modelName,
  };
}
function buildEditingAnalysisPrompt(storyboard: Storyboard, uploadedFiles: UploadedFile[]): string {
  // 建立影片與場景的對應關係
  const scenesWithVideos = storyboard.scenes.filter(s => Boolean(s.generatedVideo?.url));
  const videoSceneMapping = uploadedFiles.map((file, index) => {
    const scene = scenesWithVideos[index];
    return scene ? `Video ${index + 1} → 場景 ID: ${scene.id} (Scene ${scene.sceneNumber})` : null;
  }).filter(Boolean).join('\n');

  const scenesWithoutVideos = storyboard.scenes.filter(s => !s.generatedVideo?.url);
  const noVideoSceneIds = scenesWithoutVideos.map(s => s.id).join(', ');

  return `# Role
你是一位精通 Blender Python API (bpy) 的資深影片剪輯師，特別熟悉 **Blender 5.0+** 的最新 API 架構與 Video Sequence Editor (VSE) 自動化流程。

# Task
我提供了一系列分鏡影片和對應的分鏡表格，請**觀看每段影片的實際內容**後，提供詳細的剪輯建議。

## 分鏡表格參考:
${JSON.stringify(storyboard.scenes, null, 2)}

# ⚠️ 重要：影片與場景對應關係
我**實際傳送了 ${uploadedFiles.length} 個影片檔案**給你，對應關係如下：
${videoSceneMapping}

${scenesWithoutVideos.length > 0 ? `
⚠️ **以下場景沒有影片**（尚未生成），請勿為這些場景提供 visualConfirmation：
${noVideoSceneIds}
` : ''}

**請注意：影片實際內容可能與分鏡表格的文字描述不符。**
當兩者不一致時，**必須以你實際看到的影片畫面為準**。

你必須**只對有影片的場景**在 \`visualConfirmation\` 欄位中：
1. 描述你**實際上**看到的畫面細節（如：顏色、動作、人物特徵、背景）。
2. **不要**照抄表格中的描述，如果畫面跟描述不同，請如實寫出差異。
3. 如果影片只有幾秒鐘或不完整，也請如實描述。

**對於沒有影片的場景，請將 visualConfirmation 設為 null 或省略該欄位。**

這對於確認剪輯點非常重要，因為我們不能剪輯不存在的畫面。

# ⚠️ Critical Constraints (OpenReel / Blender / FFmpeg 共用落地規則)
你的建議會先轉成 OpenReel 專案，再盡量同步到 Blender/FFmpeg，請務必遵守：

## 1. 轉場效果 (Transitions)
- OpenReel 原生可用轉場：\`crossfade\`, \`dipToBlack\`, \`dipToWhite\`, \`wipe\`, \`slide\`, \`zoom\`, \`push\`
- 目前本系統分析輸出允許值（請只輸出這些）：\`crossfade\`, \`dipToBlack\`, \`dipToWhite\`, \`wipe\`, \`slide\`, \`push\`, \`cut\`
- 若你本來想用不在允許值內的轉場，請改寫為最接近者：
  - \`zoom\` → \`slide\` 或 \`push\`
  - \`dissolve\` / \`fade\` / \`gamma_cross\` → \`crossfade\`
  - \`none\` / \`continuation\` / \`match_cut\` → \`cut\`

## 2. 特效能力參考與輸出白名單
- OpenReel 原生可用特效：\`brightness\`, \`contrast\`, \`saturation\`, \`hue\`, \`blur\`, \`sharpen\`, \`vignette\`, \`grain\`, \`temperature\`, \`tint\`, \`tonal\`, \`chromaKey\`, \`shadow\`, \`glow\`, \`motion-blur\`, \`radial-blur\`, \`chromatic-aberration\`
- 目前本系統分析輸出允許值（請只輸出這些；每場景 0-2 個）：
- \`brightness\`
- \`contrast\`
- \`saturation\`
- \`blur\`
- \`vignette\`
- \`grain\`
- 若你想用白名單外特效，請先降級再輸出：
  - \`hue\` / \`temperature\` / \`tint\` / \`tonal\` → \`saturation\` 或 \`contrast\`
  - \`sharpen\` / \`glow\` / \`motion-blur\` / \`radial-blur\` / \`chromatic-aberration\` → \`contrast\` 或 \`blur\`
  - \`chromaKey\` / \`shadow\` → 不輸出特效（必要時保留空陣列）

若要建議速度變化，請用 \`speedFactor\`（0.6~1.4 常用），不要把速度寫進 effects。

## 4. 入出點建議
- **入點 (inPoint)**：建議剪掉開頭靜止或不穩定的部分（通常 0.3-0.5 秒）
- **出點 (outPoint)**：保留動作最精彩的部分，去除結尾靜止幀
- 入出點的差值即為該片段的有效時長

**❌ 不要建議以下效果（目前不會直接套用）：**
- sharpen, 3d_animation, motion_graphics
- logo_overlay, text_overlay, ui_animation（需外部素材）
- 複雜節點合成或需外掛的效果

# 輸出格式
請以 JSON 格式輸出，**只包含有影片的場景**，結構如下：
\`\`\`json
{
  "summary": "整體剪輯建議摘要（2-3句話說明影片風格和節奏建議）",
  "scenes": [
    {
      "sceneId": "場景 ID（必須與分鏡表格中的 id 欄位完全一致）",
      "visualConfirmation": "我看到產品在黑色背景中緩慢旋轉...",
      "inPoint": 0.5,
      "outPoint": 4.8,
      "transition": "crossfade",
      "effects": ["saturation", "vignette"],
      "speedFactor": 1.0,
      "transitionDuration": 0.5
    }
  ],
  "audioNotes": "音訊處理建議（背景音樂風格、旁白節奏、需要的音效類型）",
  "transitionDuration": 0.5
}
\`\`\`

# 剪輯原則
1. **視覺確認**：必須基於實際看到的影片內容提供建議，**不要編造沒有影片的場景內容**
2. **入出點**：考慮 AI 生成影片常見的開頭/結尾瑕疵
3. **轉場時長**：預設 0.5 秒，快節奏可用 0.3 秒
4. **效果控制**：每個場景控制在 0-2 個可直接套用效果
5. **色彩一致**：如需統一色調，優先用 saturation / contrast 的輕量調整
6. **節奏感**：根據影片內容調整 speedFactor，產品特寫可用 0.8（慢動作），動作場景用 1.2（加速）
7. **轉場可執行性**：transition 請限制在 crossfade/dipToBlack/dipToWhite/wipe/slide/push/cut
8. **白名單嚴格模式**：effects 與 transition 只可輸出白名單值；不要輸出任何未列出的名稱

請根據影片內容分析並輸出 JSON。`;
}

function parseEditingSuggestion(responseText: string, storyboard: Storyboard): EditingSuggestion {
  const extractJsonText = (text: string) => {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
    return text.slice(firstBrace, lastBrace + 1).trim();
  };

  const jsonText = extractJsonText(responseText);
  if (!jsonText) {
    throw new Error('無法解析 Gemini 回應 JSON');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error('Gemini 回傳 JSON 格式錯誤');
  }

  const source = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const scenesRaw = Array.isArray(source.scenes) ? source.scenes : [];
  const sceneIdsWithVideo = new Set(
    storyboard.scenes.filter(scene => scene.generatedVideo?.url).map(scene => scene.id)
  );

  const normalizeTransition = (value: string) => {
    const key = value.trim().toLowerCase();
    if (['crossfade', 'dissolve', 'fade', 'gamma_cross'].includes(key)) return 'crossfade';
    if (['diptoblack', 'dip_to_black', 'fade_black'].includes(key)) return 'dipToBlack';
    if (['diptowhite', 'dip_to_white', 'fade_white'].includes(key)) return 'dipToWhite';
    if (['wipe'].includes(key)) return 'wipe';
    if (['slide'].includes(key)) return 'slide';
    if (['push'].includes(key)) return 'push';
    if (['cut', 'continuation', 'none'].includes(key)) return 'cut';
    return 'crossfade';
  };
  const validEffects = new Set(['brightness', 'contrast', 'saturation', 'blur', 'vignette', 'grain']);
  const effectFallbackMap: Record<string, string> = {
    exposure: 'brightness',
    highlights: 'contrast',
    shadows: 'contrast',
    color: 'saturation',
    vibrance: 'saturation',
    hue: 'saturation',
    temperature: 'saturation',
    tint: 'saturation',
    tonal: 'contrast',
    sharpen: 'contrast',
    glow: 'vignette',
    'motion-blur': 'blur',
    motion_blur: 'blur',
    'motion blur': 'blur',
    'radial-blur': 'blur',
    radial_blur: 'blur',
    'radial blur': 'blur',
    'chromatic-aberration': 'contrast',
    chromatic_aberration: 'contrast',
    'chromatic aberration': 'contrast',
    chromakey: 'vignette',
    'chroma-key': 'vignette',
    chroma_key: 'vignette',
    'chroma key': 'vignette',
    shadow: 'contrast',
  };
  const normalizeEffect = (value: string): string | null => {
    const normalized = value.trim().toLowerCase();
    if (validEffects.has(normalized)) return normalized;
    if (effectFallbackMap[normalized]) return effectFallbackMap[normalized];
    return null;
  };

  const normalizedScenes = scenesRaw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => {
      const sceneId = typeof item.sceneId === 'string' ? item.sceneId.trim() : '';
      if (!sceneId || !sceneIdsWithVideo.has(sceneId)) return null;

      const inPointRaw = Number(item.inPoint);
      const outPointRaw = Number(item.outPoint);
      const inPoint = Number.isFinite(inPointRaw) ? Math.max(0, inPointRaw) : 0;
      const outPoint = Number.isFinite(outPointRaw) && outPointRaw > inPoint
        ? outPointRaw
        : inPoint + 3;

      const transition = typeof item.transition === 'string'
        ? normalizeTransition(item.transition)
        : 'crossfade';

      const effects = Array.isArray(item.effects)
        ? Array.from(
            new Set(
              item.effects
                .filter((value): value is string => typeof value === 'string')
                .map(normalizeEffect)
                .filter((value): value is string => Boolean(value))
            )
          ).slice(0, 2)
        : [];

      const modifiers = Array.isArray(item.modifiers)
        ? item.modifiers.filter((value): value is string => typeof value === 'string').slice(0, 2)
        : undefined;

      const speedFactorRaw = Number(item.speedFactor);
      const speedFactor = Number.isFinite(speedFactorRaw)
        ? Math.min(3, Math.max(0.25, speedFactorRaw))
        : undefined;

      const transitionDurationRaw = Number(item.transitionDuration);
      const transitionDuration = Number.isFinite(transitionDurationRaw)
        ? Math.min(2, Math.max(0.1, transitionDurationRaw))
        : undefined;

      return {
        sceneId,
        visualConfirmation: typeof item.visualConfirmation === 'string'
          ? item.visualConfirmation.trim()
          : undefined,
        inPoint,
        outPoint,
        transition,
        effects,
        modifiers,
        speedFactor,
        transitionDuration,
      };
    })
    .filter((scene): scene is NonNullable<typeof scene> => scene !== null);

  const transitionDurationRaw = Number(source.transitionDuration);
  const transitionDuration = Number.isFinite(transitionDurationRaw)
    ? Math.min(2, Math.max(0.1, transitionDurationRaw))
    : undefined;
  const timeline = Array.isArray(source.timeline)
    ? source.timeline
        .filter((marker): marker is Record<string, unknown> => !!marker && typeof marker === 'object')
        .map((marker) => {
          const time = Number(marker.time);
          const type: 'cut' | 'transition' | 'effect' =
            marker.type === 'transition' || marker.type === 'effect' ? marker.type : 'cut';
          const description = typeof marker.description === 'string' ? marker.description.trim() : '';
          if (!Number.isFinite(time) || !description) return null;
          return { time: Math.max(0, time), type, description };
        })
        .filter((marker): marker is NonNullable<typeof marker> => marker !== null)
    : [];

  return {
    summary: typeof source.summary === 'string' ? source.summary.trim() : '自動剪輯建議已生成。',
    scenes: normalizedScenes,
    timeline,
    audioNotes: typeof source.audioNotes === 'string' ? source.audioNotes.trim() : '',
    transitionDuration,
  };
}
