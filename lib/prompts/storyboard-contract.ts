export const STORYBOARD_RENDER_LANES = ['hero', 'performance', 'continuity', 'plate', 'insert', 'utility'] as const;
export const STORYBOARD_PRODUCTION_RISKS = ['low', 'medium', 'high'] as const;
export const STORYBOARD_REFERENCE_PRIORITY_MODES = ['identity_first', 'continuity_first', 'style_first', 'stage_balanced'] as const;
export const STORYBOARD_VIEW_INTENTS = ['auto', 'front', 'side', 'back', 'three_quarter', 'top'] as const;
export const STORYBOARD_WORKFLOW_STAGES = ['storyboard', 'image_start', 'image_end', 'video', 'export'] as const;
export const STORYBOARD_TRANSITION_TYPES = ['cut', 'dissolve', 'fade_black', 'fade_white', 'continuation', 'match_cut', 'wipe', 'push'] as const;
export const STORYBOARD_VIDEO_MODES = ['standard', 'reference', 'text'] as const;
export const STORYBOARD_VIDEO_CAPABILITIES = ['consistency', 'camera_ref', 'effect_ref', 'extension', 'one_shot', 'edit', 'emotion'] as const;

const sceneProperties = {
  sceneNumber: { type: 'integer', description: '場景編號' },
  description: { type: 'string', description: '場景的靜態視覺描述（不含動作）' },
  cameraMovement: { type: 'string', description: '鏡頭運動方式（不含畫面內容）' },
  sceneIntent: { type: 'string', description: '此鏡頭要傳達的核心訊息（一句話）' },
  startComposition: { type: 'string', description: '首幀構圖摘要（主體、景別、前中後景）' },
  subjectMotion: { type: 'string', description: '主體允許動作範圍（人物/商品可動邊界）' },
  continuityLock: { type: 'string', description: '此鏡頭不允許改變的連續性約束' },
  shotIntent: { type: 'string', description: '鏡頭在整體敘事中的任務（一句話）' },
  continuityAnchor: { type: 'string', description: '跨鏡頭必須維持的一個關鍵連續性錨點' },
  viewIntent: { type: 'string', enum: [...STORYBOARD_VIEW_INTENTS], description: '本鏡頭整體主視角（auto/front/side/back/three_quarter/top）' },
  referenceViewHints: {
    type: 'object',
    description: '每個角色/商品標記各自的視角需求，如 {"<台灣男性>":"front","<Galaxy S26>":"back"}',
    additionalProperties: { type: 'string', enum: [...STORYBOARD_VIEW_INTENTS] },
  },
  referencePlan: {
    type: 'array',
    description: '場景級參考圖計畫，列出每個角色/商品要用的視角與可見特徵，如 [{"tag":"<Alice>","entityType":"character","requestedView":"side","required":true,"visibleFeatures":"左側臉輪廓與耳飾"}]',
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
  renderLane: { type: 'string', enum: [...STORYBOARD_RENDER_LANES], description: 'production lane：hero / performance / continuity / plate / insert / utility' },
  productionRisk: { type: 'string', enum: [...STORYBOARD_PRODUCTION_RISKS], description: '此鏡的製作風險等級' },
  reservedForPost: { type: 'string', description: '留給後期處理的項目（字幕、cleanup、VFX、packshot finish）' },
  deliveryIntent: { type: 'string', description: '此鏡的交付用途（thumbnail / CTA / demo / bridge）' },
  referencePriorityMode: { type: 'string', enum: [...STORYBOARD_REFERENCE_PRIORITY_MODES], description: '此鏡的參考優先策略' },
  hookScore: { type: 'integer', enum: [1, 2, 3, 4, 5], description: '此鏡頭的 Hook 強度評分（1=弱, 5=強）' },
  hookScoreReason: { type: 'string', description: '為何給此 Hook 分數' },
  retentionRisk: { type: 'string', enum: ['low', 'medium', 'high'], description: '觀眾在此鏡頭流失的風險' },
  videoMode: {
    type: 'string',
    enum: [...STORYBOARD_VIDEO_MODES],
    description: '影片生成模式：standard=i2v 需首幀；reference=Seedance 2.0 多模態參考（至少需 1 張 image/video/audio 參考）；text=純文字 t2v，不需任何首幀或參考。未填視為 standard。',
  },
  videoCapability: {
    type: 'string',
    enum: [...STORYBOARD_VIDEO_CAPABILITIES],
    description: 'Seedance 2.0 進階能力提示：consistency/camera_ref/effect_ref/extension/one_shot/edit/emotion。沒有明確能力需求時不要輸出此欄位。',
  },
  requiresEndFrame: { type: 'boolean', description: 'AI 判斷是否需要生成尾幀' },
  endFrameDescription: { type: 'string', description: '尾幀的靜態畫面描述（只在 requiresEndFrame = true 時填寫，否則留空）' },
  endFrameDelta: { type: 'string', description: '尾幀相對首幀的差異描述（只在 requiresEndFrame = true 時填寫）' },
  endFrameDeltaSpec: {
    type: 'object',
    description: '尾幀差異的半結構化規格（可量化）',
    properties: {
      reframingGoal: { type: 'string' },
      subjectScaleChangePct: { type: 'string' },
      newVisibleArea: { type: 'string' },
      mustNotChange: { type: 'array', items: { type: 'string' } },
    },
  },
  dialogue: { type: 'string', description: '對話或旁白' },
  duration: { type: 'number', description: '場景時長（秒）' },
  notes: { type: 'string', description: '額外備註' },
  charactersUsed: { type: 'array', items: { type: 'string' }, description: '本場景使用的角色標記列表（如 <Alice>）' },
  productsUsed: { type: 'array', items: { type: 'string' }, description: '本場景使用的商品標記列表（如 <iPhone>）' },
  changeFromPrev: { type: 'string', description: '相對前一場景的變化摘要（第一場景填 N/A）' },
  requiredReferences: { type: 'array', items: { type: 'string' }, description: '本鏡頭必須使用的參考標記（如 ["<Alice>", "<iPhone>"]）' },
  transitionToNext: {
    type: 'object',
    description: '與下一場景的轉場設定',
    properties: {
      type: { type: 'string', enum: [...STORYBOARD_TRANSITION_TYPES], description: '轉場類型' },
      reason: { type: 'string', description: 'AI 選擇此轉場的原因' },
      duration: { type: 'number', description: '轉場時長（秒），預設 0.5' },
      useEndFrameAsNextStart: { type: 'boolean', description: '是否讓下一場景使用此場景的 endFrame 作為開始幀' },
      continuitySourceMode: { type: 'string', enum: ['auto', 'previous_end_only', 'previous_start_only', 'none'], description: 'continuation 時的畫面來源模式' },
    },
    required: ['type', 'reason'],
  },
} as const;

const sceneRequired = [
  'sceneNumber',
  'description',
  'cameraMovement',
  'sceneIntent',
  'startComposition',
  'subjectMotion',
  'continuityLock',
  'shotIntent',
  'continuityAnchor',
  'viewIntent',
  'referenceViewHints',
  'referencePlan',
  'renderLane',
  'productionRisk',
  'reservedForPost',
  'deliveryIntent',
  'referencePriorityMode',
  'hookScore',
  'hookScoreReason',
  'retentionRisk',
  'requiresEndFrame',
  'endFrameDelta',
  'dialogue',
  'duration',
  'charactersUsed',
  'productsUsed',
  'changeFromPrev',
  'requiredReferences',
  'transitionToNext',
] as const;

export function buildStoryboardOutputSchema() {
  return {
    type: 'object',
    properties: {
      title: { type: 'string', description: '分鏡腳本標題' },
      sharedAnchors: {
        type: 'array',
        items: { type: 'string' },
        description: '全片共用的 continuity / identity / composition anchors',
      },
      sharedContinuityDirectives: {
        type: 'array',
        description: '全片共用的 continuity directives',
        items: {
          type: 'object',
          properties: {
            anchorLabel: { type: 'string' },
            directive: { type: 'string' },
            appliesToStages: { type: 'array', items: { type: 'string', enum: [...STORYBOARD_WORKFLOW_STAGES] } },
          },
          required: ['anchorLabel', 'directive'],
        },
      },
      scenes: {
        type: 'array',
        items: {
          type: 'object',
          properties: sceneProperties,
          required: [...sceneRequired],
        },
      },
    },
    required: ['title', 'sharedAnchors', 'sharedContinuityDirectives', 'scenes'],
  };
}

export const STORYBOARD_CONTRACT_PROMPT_BLOCK = `
輸出 contract（必須遵守，避免 schema drift）：
- JSON 頂層必須包含：title、sharedAnchors、sharedContinuityDirectives、scenes。
- sharedAnchors：輸出 0-N 條全片共用 anchor；沒有就輸出 []。
- sharedContinuityDirectives：輸出 0-N 條 { anchorLabel, directive, appliesToStages? }；沒有就輸出 []。
- 每個 scene 都必須輸出：sceneIntent / startComposition / subjectMotion / continuityLock / shotIntent / continuityAnchor / viewIntent / referenceViewHints / referencePlan。
- 每個 scene 都必須輸出 production 欄位：renderLane / productionRisk / reservedForPost / deliveryIntent / referencePriorityMode。
- 每個 scene 都必須輸出觀看吸引力欄位：hookScore / hookScoreReason / retentionRisk。
- renderLane 只能是：hero | performance | continuity | plate | insert | utility。
- productionRisk 只能是：low | medium | high。
- referencePriorityMode 只能是：identity_first | continuity_first | style_first | stage_balanced。
- 若沒有明確後期需求，reservedForPost 也要輸出空字串 ""，不能省略。
- 若沒有明確交付目的，deliveryIntent 也要輸出空字串 ""，不能省略。
- 若沒有必用參考，requiredReferences 必須輸出 []，不能省略。
- referencePlan 必須列出本鏡實際依賴的每個角色/商品；若沒有角色/商品參考則輸出 []。
- referencePlan 每個 item 必須至少包含：tag / requestedView / required；若 requestedView 為非正面視角，應補 visibleFeatures。
- 若場景同時有角色與商品，referenceViewHints 應針對每個標記明確輸出其視角需求；例如人物正面、商品背面，必須分開標記，不能只靠單一 viewIntent。
- 若某個標記的 referenceViewHints 為非正面視角（side/back/three_quarter/top），description 必須描述從該視角可見的內容，例如「<Galaxy S26> 背面朝向鏡頭，相機模組陣列清晰可見」；不可只寫標記名稱而不說明可見特徵。
- 第一場 scene 的 hookScore 應盡量 >= 4；若低於 4，hookScoreReason 必須清楚說明原因。
- 若 requiresEndFrame = false，endFrameDescription 與 endFrameDelta 必須是空字串。
- videoMode 判定規則：
  · 預設 standard（走 image-to-video，需要首幀）。
  · 若場景需要鎖定角色/商品身份且同時複刻另一鏡的運鏡/節奏/特效、或依賴音色/配樂參考，輸出 reference 並在 requiredReferences 或 notes 說明複刻的面向。
  · 若場景是純抽象/意象/資訊圖層（如純文字動畫、抽象轉場、概念 bumper），沒有任何角色/商品需要鎖身份，輸出 text。
  · 一旦輸出 text，requiresEndFrame 必須為 false（純文字生成沒有首尾幀）。
- videoCapability 指引（選填）：
  · 若本鏡要延續前一鏡的同一拍（同一路 take，只是延長秒數），輸出 extension。
  · 若本鏡是一鏡到底/不切鏡頭的長鏡頭，輸出 one_shot 並讓 transitionToNext.type = continuation。
  · 若本鏡以前一鏡的成片為底只做局部編輯（換色/改物件/加字），輸出 edit。
  · 若本鏡有強烈情緒戲（哭/笑/驚訝），可輸出 emotion；若鏡頭語言（運鏡/特效/氛圍）是刻意複刻另一個參考素材，可輸出 camera_ref / effect_ref / consistency。
`;
