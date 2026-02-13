import { GoogleGenAI } from '@google/genai';
import { Storyboard } from '../types/storyboard';
import { EditingSuggestion } from '../types/project';

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
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, file.name);

  const fs = await import('fs/promises');
  await fs.writeFile(tempPath, buffer);

  // 使用新 SDK 的 files API
  const uploadResult = await ai.files.upload({
    file: tempPath,
    config: {
      mimeType: file.type,
      displayName: file.name,
    },
  });

  // 等待處理完成
  let uploadedFile = await ai.files.get({ name: uploadResult.name || '' });
  while (uploadedFile.state === 'PROCESSING') {
    await new Promise(resolve => setTimeout(resolve, 5000));
    uploadedFile = await ai.files.get({ name: uploadResult.name || '' });
  }

  // 清理臨時檔案
  await fs.unlink(tempPath);

  return {
    name: uploadedFile.name || '',
    uri: uploadedFile.uri || '',
    mimeType: uploadedFile.mimeType || file.type,
    sizeBytes: uploadedFile.sizeBytes?.toString(),
    state: uploadedFile.state as 'PROCESSING' | 'ACTIVE' | 'FAILED',
  };
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
        `1. 在 .env.local 中將 GEMINI_MODEL 改為 gemini-1.5-flash\\n` +
        `2. 或使用 gemini-1.5-pro (更高配額)\\n` +
        `3. 或等待配額重置（通常為每日/每分鐘限制）\\n\\n` +
        `原始錯誤: ${message || 'Unknown error'}`
      );
    }

    // 其他錯誤直接拋出
    throw error;
  }
}

function buildEditingAnalysisPrompt(storyboard: Storyboard, uploadedFiles: UploadedFile[]): string {
  // 建立影片與場景的對應關係
  const scenesWithVideos = storyboard.scenes.filter(s => s.generatedVideo);
  const videoSceneMapping = uploadedFiles.map((file, index) => {
    const scene = scenesWithVideos[index];
    return scene ? `Video ${index + 1} → 場景 ID: ${scene.id} (Scene ${scene.sceneNumber})` : null;
  }).filter(Boolean).join('\n');

  const scenesWithoutVideos = storyboard.scenes.filter(s => !s.generatedVideo);
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

# ⚠️ Critical Constraints (Blender 5.0 API 規則)
你的建議將直接轉換為 Blender 5.0+ VSE Python 腳本，請務必遵守：

## 1. 轉場效果 (Transitions)
- 為了讓轉場生效，前後兩個片段必須在時間軸上有 **重疊 (Overlap)**
- 片段會交錯放置在 Channel 1 和 Channel 2，避免碰撞
- 可用轉場類型：
  - \`crossfade\`: 淡入淡出（最常用，標準交叉溶解）
  - \`gamma_cross\`: Gamma 校正交叉溶解（更自然的過渡）
  - \`wipe\`: 擦除轉場（多種擦除方向可選）
  - \`cut\`: 直接切換（無需重疊）

## 2. 可直接套用的效果（先以 OpenReel 相容為主，Blender/FFmpeg 也會盡量對齊）
請優先從以下效果關鍵詞中選擇（每場景 0-2 個）：
- \`brightness\`
- \`contrast\`
- \`saturation\`
- \`blur\`
- \`vignette\`
- \`grain\`

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
        ? item.effects
            .filter((value): value is string => typeof value === 'string')
            .map(value => value.trim().toLowerCase())
            .filter(value => validEffects.has(value))
            .slice(0, 2)
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
