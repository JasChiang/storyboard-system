// 轉場類型
export type TransitionType =
  | 'cut'           // 硬切 (直接接合，無轉場效果)
  | 'dissolve'      // 交叉溶解
  | 'fade_black'    // 淡入黑場
  | 'fade_white'    // 淡入白場
  | 'continuation'  // 延續 (用 endFrame 作為下一場景的 startFrame)
  | 'match_cut'     // 形狀/動作匹配剪接
  | 'wipe'          // 擦除轉場
  | 'push';         // 推出轉場

// 與下一場景的轉場設定
export interface TransitionToNext {
  type: TransitionType;
  reason?: string;                    // AI 選擇此轉場的原因
  duration?: number;                  // 轉場時長 (秒)，預設 0.5
  useEndFrameAsNextStart?: boolean;   // 是否讓下一場景使用此場景的 endFrame 作為開始幀
}

// 場景資料結構
export interface Scene {
  id: string;
  sceneNumber: number;
  description: string;           // 場景描述
  cameraMovement: string;        // 鏡頭運動
  dialogue: string;              // 對話/旁白
  duration: number;              // 時長建議 (秒)
  notes?: string;                // 備註
  changeFromPrev?: string;       // 相對前一場景的變化摘要（用於連貫生成）
  charactersUsed?: string[];     // 本場景使用的角色標記（如 <Alice>）
  productsUsed?: string[];       // 本場景使用的商品標記（如 <iPhone>）

  // Smart Keyframing (智慧首尾幀)
  requiresEndFrame?: boolean;    // AI 判斷是否需要生成尾幀
  endFrameDescription?: string;  // 尾幀的靜態畫面描述

  // 與下一場景的轉場設定
  transitionToNext?: TransitionToNext;

  // 生成資源
  referenceImage?: string;       // 參考素材圖 (base64 or URL)
  generatedImage?: {
    url: string;
    prompt: string;
    timestamp: string;
  };
  generatedEndFrame?: {          // 尾幀圖片 (當 requiresEndFrame=true 時生成)
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
  originalPrompt: string;        // 使用者原始輸入
  templateUsed: string;          // 使用的提示詞模板
  scenes: Scene[];
  projectReferences?: ProjectReference[];  // 專案級參考圖
  selectedStyleProfileId?: string;
  customStyleProfiles?: StyleProfile[];
  createdAt: string;
  updatedAt: string;
}

export interface StyleProfile {
  id: string;
  name: string;
  stylePrompt: string;
  negativePrompt?: string;
  styleReferenceIds?: string[];
  isPreset?: boolean;
}

// 專案級參考圖
export interface ProjectReference {
  id: string;
  url: string;                   // Fal Storage URL
  description: string;           // 描述（手動輸入或 AI 生成）
  type: 'character' | 'product' | 'environment' | 'style';
  name?: string;                 // 角色名稱 或 商品名稱
  descriptionSource: 'manual' | 'ai';  // 描述來源
  guidelines?: string;           // 規則/限制（生成提示詞用）

  // Multi-Angle Support (多視角支援)
  angle?: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';  // 視角標籤
  aiDescription?: string;        // Vision AI 自動生成的詳細描述
  mustKeepFeatures?: string[];   // 生成時不可改變的關鍵特徵
  identityCore?: string;         // 核心身份描述（形狀/比例/Logo）
  styleTraits?: string;          // 風格特徵描述
  angleVisibility?: string;      // 此視角可見/不可見重點
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
