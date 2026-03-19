import type { ElevenLabsMusicPromptIdea, IndexTtsRequestInput, IndexTtsScenePlan } from './audio';

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
  continuitySourceMode?: 'auto' | 'previous_end_only' | 'previous_start_only' | 'none';
}

// 場景資料結構
export type WorkflowStage = 'storyboard' | 'image_start' | 'image_end' | 'video' | 'export';
export type RenderLane = 'hero' | 'performance' | 'continuity' | 'plate' | 'insert' | 'utility';
export type ProductionRisk = 'low' | 'medium' | 'high';
export type ReferencePriorityMode = 'identity_first' | 'continuity_first' | 'style_first' | 'stage_balanced';

export interface SharedContinuityDirective {
  anchorLabel: string;
  directive: string;
  appliesToStages?: WorkflowStage[];
}

export interface Scene {
  id: string;
  sceneNumber: number;
  description: string;           // 場景描述
  cameraMovement: string;        // 鏡頭運動
  sceneIntent?: string;          // 此鏡頭想傳達的訊息/情緒目標
  startComposition?: string;     // 首幀構圖摘要（供首尾幀延續）
  subjectMotion?: string;        // 主體允許動作範圍（人物/商品）
  continuityLock?: string;       // 必須維持不變的連續性約束
  dialogue: string;              // 對話/旁白
  duration: number;              // 時長建議 (秒)
  notes?: string;                // 備註
  beatGoal?: string;             // 此鏡頭要完成的敘事目標
  shotIntent?: string;           // 鏡頭意圖（情緒/資訊焦點）
  continuityAnchor?: string;     // 跨鏡頭連續性的錨點（姿勢/構圖/道具狀態）
  renderLane?: RenderLane;       // Production lane：hero / continuity / insert ...
  productionRisk?: ProductionRisk; // 製作風險等級
  reservedForPost?: string;      // 留給後期處理的項目（字幕/packshot cleanup/VFX）
  deliveryIntent?: string;       // 此鏡交付用途（thumbnail / CTA / demo / bridge）
  referencePriorityMode?: ReferencePriorityMode; // 此鏡偏好的參考優先序
  referencePriorityByStage?: Partial<Record<WorkflowStage, ReferencePriorityMode>>;
  requiredReferences?: string[]; // 本鏡頭必用參考標記（如 ["<Alice>", "<ProductX>"]）
  changeFromPrev?: string;       // 相對前一場景的變化摘要（用於連貫生成）
  charactersUsed?: string[];     // 本場景使用的角色標記（如 <Alice>）
  productsUsed?: string[];       // 本場景使用的商品標記（如 <iPhone>）
  consistencyWarnings?: string[]; // 一致性檢查警告（由生成後校驗標記）
  qaStatus?: 'pass' | 'warn' | 'block';
  qaIssues?: string[];

  // Smart Keyframing (智慧首尾幀)
  requiresEndFrame?: boolean;    // AI 判斷是否需要生成尾幀
  endFrameDescription?: string;  // 尾幀的靜態畫面描述
  endFrameDelta?: string;        // 尾幀相對首幀的變更描述（只寫差異）
  endFrameDeltaSpec?: {
    reframingGoal?: string;      // 構圖目標（如主體移至左1/3）
    subjectScaleChangePct?: string; // 主體畫面比例變化（如 +10% / -15%）
    newVisibleArea?: string;     // 新增可見區域
    mustNotChange?: string[];    // 不可改變項目
  };

  // 與下一場景的轉場設定
  transitionToNext?: TransitionToNext;

  // 廣告效果評估
  hookScore?: 1 | 2 | 3 | 4 | 5;         // Hook 強度評分（1=弱 5=強）
  hookScoreReason?: string;               // 評分說明
  retentionRisk?: 'low' | 'medium' | 'high'; // 觀眾流失風險

  // 生成資源
  referenceImage?: string;       // 參考素材圖 (base64 or URL)
  generatedImage?: {
    url: string;
    prompt: string;
    seed?: number;
    timestamp: string;
  };
  generatedEndFrame?: {          // 尾幀圖片 (當 requiresEndFrame=true 時生成)
    url: string;
    prompt: string;
    seed?: number;
    timestamp: string;
  };
  motionPrompt?: string;         // 動作提示詞
  videoPromptDraft?: string;     // 影片提示詞草稿（AI Composer 產生但尚未生成影片）
  videoPromptDraftNotes?: string; // AI Composer 備註
  generatedVideo?: {
    url: string;
    model: 'kling' | 'seedance';
    prompt: string;
    durationSeconds?: number;
    timestamp: string;
  };
  generatedVoiceover?: {
    url: string;
    model: 'index-tts-2';
    script: string;
    prompt?: string;
    requestPayload?: IndexTtsRequestInput;
    reasoning?: string;
    durationSeconds?: number;
    timestamp: string;
  };
}

// 分鏡表格
export interface Storyboard {
  id: string;
  projectId: string;
  title: string;
  productionPresetId?: string;
  productionNotes?: string;
  sharedAnchors?: string[];
  sharedContinuityDirectives?: SharedContinuityDirective[];
  globalContinuityDraft?: {
    sharedAnchors: string[];
    sharedContinuityDirectives: SharedContinuityDirective[];
    sourceSignature: string;
    generatedAt: string;
  };
  originalPrompt: string;        // 使用者原始輸入
  templateUsed: string;          // 使用的提示詞模板
  scenes: Scene[];
  projectReferences?: ProjectReference[];  // 專案級參考圖
  selectedStyleProfileId?: string;
  customStyleProfiles?: StyleProfile[];
  generatedMusic?: {
    url: string;
    model: 'elevenlabs-music' | 'minimax-music-v2';
    prompt: string;
    durationSeconds?: number;
    timestamp: string;
  };
  audioPlanningDraft?: {
    voiceRefUrl?: string;
    emotionalVoiceRefUrl?: string;
    voiceDirection?: string;
    voiceoverPlans?: IndexTtsScenePlan[];
    musicProvider?: 'elevenlabs' | 'minimax';
    musicPrompt?: string;
    minimaxLyricsPrompt?: string;
    musicDurationSec?: number;
    musicPromptIdeas?: ElevenLabsMusicPromptIdea[];
    updatedAt: string;
  };
  audioMixSettings?: {
    voiceoverVolume?: number; // 0-1.5
    musicVolume?: number;     // 0-1.5
    ducking?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StyleProfile {
  id: string;
  name: string;
  stylePrompt: string;
  negativePrompt?: string;
  usage?: string;
  productionPreset?: string;
  defaultRenderLane?: RenderLane;
  continuityStrategy?: string;
  recommendedStages?: WorkflowStage[];
  stagePromptOverrides?: Partial<Record<WorkflowStage, string>>;
  stageNegativeOverrides?: Partial<Record<WorkflowStage, string>>;
  styleReferenceIds?: string[];
  isPreset?: boolean;
}

// 專案級參考圖
export type IpTextLogoPolicy = 'lock_visible_text' | 'forbid_new_text';

export interface IpGenerationDefaults {
  preferredVideoModel?: 'kling' | 'seedance';
  preferredOutputAspectRatio?: '16:9' | '9:16' | '1:1';
  preferredKlingDuration?: 5 | 10;
  preferredSeedanceDuration?: number; // 4-12
}

export interface IpProfile {
  profileVersion: number;
  strictIdentity: boolean;
  allowAccessoryChanges: boolean;
  textLogoPolicy: IpTextLogoPolicy;
  immutableRules?: string[];
  generationDefaults?: IpGenerationDefaults;
}

export interface StructuredIdentityLock {
  version: number;
  entityType: 'character' | 'product';
  appearanceSummary?: string;
  geometry?: string[];
  materials?: string[];
  logoText?: string[];
  requiredParts?: string[];
  forbiddenChanges?: string[];
}

export type ReferenceAnchorRole =
  | 'primary_character_anchor'
  | 'supporting_character'
  | 'product_anchor'
  | 'environment_anchor'
  | 'style_modifier';

export interface ProjectReference {
  id: string;
  url: string;                   // Fal Storage URL
  description: string;           // 描述（手動輸入或 AI 生成）
  type: 'character' | 'product' | 'environment' | 'style';
  name?: string;                 // 角色名稱 或 商品名稱
  anchorRole?: ReferenceAnchorRole; // 進入專案後扮演的 continuity / reference 角色
  descriptionSource: 'manual' | 'ai';  // 描述來源
  guidelines?: string;           // 規則/限制（生成提示詞用）

  // Multi-Angle Support (多視角支援)
  angle?: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';  // 視角標籤
  aiDescription?: string;        // Vision AI 自動生成的詳細描述
  mustKeepFeatures?: string[];   // 生成時不可改變的關鍵特徵
  identityCore?: string;         // 核心身份描述（形狀/比例/Logo）
  styleTraits?: string;          // 風格特徵描述
  angleVisibility?: string;      // 此視角可見/不可見重點
  ipProfile?: IpProfile;         // 來自角色庫的 IP 套件設定
  structuredIdentityLock?: StructuredIdentityLock; // 結構化保真鎖（可選，缺省時由既有欄位自動推導）
  sourceCharacterLibraryItemId?: string;
  sourceCharacterLibraryVersion?: number;
  sourceCharacterSnapshotId?: string;
  sourceCharacterStatus?: 'draft' | 'reviewed' | 'production_ready' | 'archived';
  referenceVersionSeed?: string;   // 鎖定專案引用時使用的版本快照種子
  isAnchor?: boolean;
  usageRole?: 'anchor' | 'supporting' | 'style_support';
}

// 提示詞模板
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  outputSchema: Record<string, unknown>;  // JSON Schema
}

// 場景創意評估
export interface SceneCreativeReview {
  sceneNumber: number;
  hookScore: 1 | 2 | 3 | 4 | 5;
  hookScoreReason: string;
  retentionRisk: 'low' | 'medium' | 'high';
  weakPoint: string;
  suggestion: string;
}

// 整體創意評估
export interface CreativeReview {
  emotionalArc: string;
  pacing: string;
  strongestScene: number;
  weakestScene: number;
  sceneReviews: SceneCreativeReview[];
}

// Hook 變體
export interface HookVariant {
  variantType: 'shock' | 'question' | 'story';
  variantLabel: string;
  scene: Omit<Scene, 'id' | 'referenceImage' | 'generatedImage' | 'motionPrompt' | 'generatedVideo' | 'generatedVoiceover'>;
}

// API 回應類型
export interface StoryboardGenerationResponse {
  title: string;
  sharedAnchors?: string[];
  sharedContinuityDirectives?: SharedContinuityDirective[];
  scenes: Omit<Scene, 'id' | 'referenceImage' | 'generatedImage' | 'motionPrompt' | 'generatedVideo' | 'generatedVoiceover'>[];
}
