// 場景資料結構
export interface Scene {
  id: string;
  sceneNumber: number;
  description: string;           // 場景描述
  cameraMovement: string;        // 鏡頭運動
  dialogue: string;              // 對話/旁白
  duration: number;              // 時長建議 (秒)
  notes?: string;                // 備註

  // 生成資源
  referenceImage?: string;       // 參考素材圖 (base64 or URL)
  generatedImage?: {
    url: string;
    prompt: string;
    timestamp: string;
  };
  motionPrompt?: string;         // 動作提示詞
  generatedVideo?: {
    url: string;
    model: 'kling' | 'seedance';
    prompt: string;
    timestamp: string;
  };
}

// 分鏡表格
export interface Storyboard {
  id: string;
  projectId: string;
  title: string;
  originalPrompt: string;        // 用戶原始輸入
  templateUsed: string;          // 使用的提示詞模板
  scenes: Scene[];
  projectReferences?: ProjectReference[];  // 專案級參考圖
  createdAt: string;
  updatedAt: string;
}

// 專案級參考圖
export interface ProjectReference {
  id: string;
  url: string;                   // Fal Storage URL
  description: string;           // 描述（手動輸入或 AI 生成）
  type: 'character' | 'product' | 'environment' | 'style';
  name?: string;                 // 角色名稱 或 商品名稱
  descriptionSource: 'manual' | 'ai';  // 描述來源
}

// 提示詞模板
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  outputSchema: Record<string, unknown>;  // JSON Schema
}

// API 回應類型
export interface StoryboardGenerationResponse {
  title: string;
  scenes: Omit<Scene, 'id' | 'referenceImage' | 'generatedImage' | 'motionPrompt' | 'generatedVideo'>[];
}
