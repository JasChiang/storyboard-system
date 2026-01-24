import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
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
  // 注意：GoogleAIFileManager 需要在 Node.js 環境運行
  // 這個函數應該在 API Route 中使用
  const fileManager = new GoogleAIFileManager(config.apiKey);

  // 將 File 轉換為 Buffer (在 API Route 中)
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 建立臨時檔案
  const tempPath = `/tmp/${file.name}`;
  const fs = await import('fs/promises');
  await fs.writeFile(tempPath, buffer);

  const uploadResult = await fileManager.uploadFile(tempPath, {
    mimeType: file.type,
    displayName: file.name,
  });

  // 等待處理完成
  let uploadedFile = await fileManager.getFile(uploadResult.file.name);
  while (uploadedFile.state === 'PROCESSING') {
    await new Promise(resolve => setTimeout(resolve, 5000));
    uploadedFile = await fileManager.getFile(uploadResult.file.name);
  }

  // 清理臨時檔案
  await fs.unlink(tempPath);

  return {
    name: uploadedFile.name,
    uri: uploadedFile.uri,
    mimeType: uploadedFile.mimeType,
    sizeBytes: uploadedFile.sizeBytes,
    state: uploadedFile.state as 'PROCESSING' | 'ACTIVE' | 'FAILED',
  };
}

// 分析影片並生成剪輯建議
export async function analyzeVideosForEditing(
  uploadedFiles: UploadedFile[],
  storyboard: Storyboard,
  config: GeminiConfig
): Promise<EditingSuggestion> {
  const genAI = new GoogleGenerativeAI(config.apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
  const model = genAI.getGenerativeModel({ model: modelName });

  // 構建影片內容參考
  const videoParts = uploadedFiles.map(file => ({
    fileData: {
      mimeType: file.mimeType,
      fileUri: file.uri,
    }
  }));

  const prompt = buildEditingAnalysisPrompt(storyboard);

  const result = await model.generateContent([
    ...videoParts,
    { text: prompt }
  ]);

  const responseText = result.response.text();
  return parseEditingSuggestion(responseText);
}

function buildEditingAnalysisPrompt(storyboard: Storyboard): string {
  return `你是專業的影片剪輯師。我提供了一系列分鏡影片和對應的分鏡表格。

分鏡表格:
${JSON.stringify(storyboard.scenes, null, 2)}

請分析這些影片並提供詳細的剪輯建議，包括：
1. 每個場景的建議入點 (in point) 和出點 (out point) - 以秒為單位
2. 場景之間的轉場效果建議 (crossfade, wipe, cut, etc.)
3. 需要添加的視覺效果 (glow, blur, color_correction, etc.)
4. 音頻處理建議
5. 整體節奏和時間線建議

請以 JSON 格式輸出，結構如下：
{
  "summary": "整體剪輯建議摘要",
  "scenes": [
    {
      "sceneId": "場景ID",
      "inPoint": 0.5,
      "outPoint": 4.8,
      "transition": "crossfade",
      "effects": ["glow", "color_correction"]
    }
  ],
  "timeline": [
    {
      "time": 10.5,
      "type": "transition",
      "description": "從場景 1 淡入場景 2"
    }
  ],
  "audioNotes": "音頻處理建議"
}`;
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
