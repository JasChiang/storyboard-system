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
  const tempPath = `/tmp/${file.name}`;
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
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';

    // 構建影片內容參考
    const videoParts = uploadedFiles.map(file => ({
      fileData: {
        mimeType: file.mimeType,
        fileUri: file.uri,
      }
    }));

    const prompt = buildEditingAnalysisPrompt(storyboard);

    // 使用新 SDK 的 models API
    const result = await ai.models.generateContent({
      model: modelName,
      contents: [
        ...videoParts,
        { text: prompt }
      ],
    });

    const responseText = result.text || '';
    return parseEditingSuggestion(responseText);
  } catch (error: any) {
    // 處理配額超限錯誤
    if (error?.message?.includes('quota') || error?.message?.includes('429')) {
      throw new Error(
        `Gemini API 配額已超限。建議解決方案：\\n` +
        `1. 在 .env.local 中將 GEMINI_MODEL 改為 gemini-1.5-flash\\n` +
        `2. 或使用 gemini-1.5-pro (更高配額)\\n` +
        `3. 或等待配額重置（通常為每日/每分鐘限制）\\n\\n` +
        `原始錯誤: ${error.message}`
      );
    }

    // 其他錯誤直接拋出
    throw error;
  }
}

function buildEditingAnalysisPrompt(storyboard: Storyboard): string {
  return `你是專業的影片剪輯師，專精於 Blender Video Sequence Editor (VSE) 剪輯。
我提供了一系列分鏡影片和對應的分鏡表格。

分鏡表格:
${JSON.stringify(storyboard.scenes, null, 2)}

請**觀看每段影片的實際內容**後，提供詳細的剪輯建議。

⚠️ **重要**：你必須在每個場景建議中包含 \`visualConfirmation\` 欄位，
簡短描述你在該影片中實際看到的內容（1-2 句話），以確認你真的觀看了影片。

## 重要限制：
⚠️ 你的建議將直接轉換為 Blender VSE Python 腳本，因此：
1. **只能建議 Blender VSE 原生支援的效果**
2. **不要建議需要外部素材或插件的效果**
3. **不要建議需要進階節點或 3D 工作區的效果**

## 可用的轉場效果 (Transitions):
- crossfade: 淡入淡出（最常用）
- wipe: 擦除轉場
- cut: 直接切換（實際上會用快速的 crossfade）

## 可用的視覺效果 (Effects):
**可直接實現：**
- color_correction: 調色（調整飽和度、色彩倍數）
- glow: 發光/光暈效果（適合強調亮部）
- blur: 模糊/高斯模糊
- transform: 變換（縮放、位移，需手動設置關鍵影格）

**不要建議以下效果（無法在 VSE 中實現）：**
- ❌ sharpen, 3d_animation, motion_graphics
- ❌ logo_overlay, text_overlay, ui_animation
- ❌ 任何需要外部素材的效果

## 輸出要求：

請以 JSON 格式輸出剪輯建議，結構如下：
{
  "summary": "整體剪輯建議摘要（2-3句話說明影片風格和節奏）",
  "scenes": [
    {
      "sceneId": "場景的 ID（必須與分鏡表格中的 id 欄位完全一致）",
      "visualConfirmation": "我看到產品在黑色背景中緩慢旋轉，前半秒靜止，後段光線漸暗",
      "inPoint": 0.5,  // 入點（秒），建議剪掉開頭靜止或不穩定的部分
      "outPoint": 4.8, // 出點（秒），保留動作最精彩的部分
      "transition": "crossfade", // 到下一個場景的轉場，只能用: crossfade, wipe, cut
      "effects": ["color_correction", "glow"] // 只能用上述「可直接實現」的效果
    }
  ],
  "audioNotes": "音頻處理建議（背景音樂風格、旁白節奏、需要的音效類型）"
}

## 剪輯原則：
1. **視覺確認**：必須基於實際看到的影片內容提供建議，不要只根據文字描述猜測
2. **入出點**：去除開頭結尾的靜止幀，保留動作最流暢的部分
3. **轉場**：預設用 crossfade，快節奏用 cut，特殊過渡用 wipe
4. **效果**：控制在 2-3 個，避免過度使用
5. **色彩**：如需統一色調，對所有場景都添加 color_correction

請根據影片內容分析並輸出 JSON。`;
}

function parseEditingSuggestion(responseText: string): EditingSuggestion {
  // 嘗試從回應中提取 JSON
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('無法解析 Gemini 回應');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    throw new Error('JSON 解析失敗');
  }
}
