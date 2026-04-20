/**
 * Shared prompt blocks reused across storyboard templates.
 * Each block is a single source of truth; update here to propagate to all templates.
 */

export const SHARED_SCENE_FIELDS_BLOCK = `
## 每個場景必填欄位（schema 必須遵守）

1. sceneNumber：場景編號（從 1 開始連續）
2. description：靜態畫面描述（環境、人物位置/姿態/表情、光線、構圖、視覺風格；不含動作或運鏡）
3. cameraMovement：鏡頭動態（Dolly in/out、Pan、Zoom、Crane、Orbit、Static 等；不含畫面內容）
4. sceneIntent / startComposition / subjectMotion / continuityLock：結構化鏡頭欄位
5. shotIntent / continuityAnchor：敘事任務與單一連續性錨點
6. viewIntent / referenceViewHints / referencePlan：視角與參考圖計畫（可用視角只能填「可用視角索引」中出現的值）
7. requiresEndFrame：智慧尾幀判斷（見下方規則）
8. endFrameDescription / endFrameDelta：尾幀填寫（requiresEndFrame = false 時必須為空字串 ""）
9. transitionToNext：與下一場景的轉場設定（type + reason，必要時 duration / useEndFrameAsNextStart / continuitySourceMode）
10. dialogue：對話或旁白
11. duration：場景時長（秒）
12. notes：製作提示、特效需求、可選 [HOOK: ...] / [TWIST: ...] / [REWATCH: ...] / [SCREEN: ...] 標記
13. charactersUsed / productsUsed：本場景使用的角色/商品標記陣列（如 ["<Alice>"], ["<iPhone>"]）
14. changeFromPrev：相對前一場景的關鍵變化（第一場填 "N/A"）
15. hookScore (1-5) / hookScoreReason / retentionRisk (low/medium/high)
16. renderLane / productionRisk / reservedForPost / deliveryIntent / referencePriorityMode
17. requiredReferences：本鏡頭必須使用的 <標記> 陣列；沒有必用參考則輸出 []

⚠️ description 只寫靜態畫面內容，cameraMovement 只寫鏡頭運動方式；兩者禁止混寫。
⚠️ 若已提供角色/商品參考圖，不可在 description 重新定義其外觀（髮型、臉型、服裝顏色、材質、Logo 細節）；描述聚焦於位置、朝向、姿態、光影與相對關係。
`;

export const SHARED_HOOK_PATTERNS_BLOCK = `
## Hook Design Rules（第一場景必選其一 Pattern Interrupt）

- Visual Conflict：視覺衝突開場（對比色、破碎感、意外物件）
- Question Hook：強問句或懸念字幕（「你知道嗎？」「為什麼…」）
- Action-First：直接動作開場，跳過鋪墊（人物已在行動中）
- Counter-Intuitive：反直覺畫面（顛覆期待的構圖或場景）

第一場規則：
- sceneIntent 必須回答：「觀眾只看此幀為何想繼續？」
- 第一幀必須能當縮圖：清晰主體、強對比、明確焦點
- hookScore 應 >= 4；若低於 4，hookScoreReason 必須說明原因並優先重寫第一場
- 可在 notes 加入 [HOOK: pattern] 或 [REWATCH: reason] 標記

留存節奏：
- 每個場景只承擔一個主要任務：hook / setup / escalate / reveal / payoff / CTA
- 中段至少一次 escalation / twist / reveal，避免平鋪直敘
- 最後一場需有 payoff、CTA 或可分享/重看的瞬間
- 相鄰兩場不可都做中性鋪陳；若資訊重複，後一場必須提升衝突、資訊新意、情緒落差或視覺奇觀
`;

export const SHARED_END_FRAME_JUDGMENT_BLOCK = `
## 智慧首尾幀判斷（requiresEndFrame）

【保守原則（預設）】：
- 僅人物對話、細微動作、口播、商品展示 → requiresEndFrame = false
- 明顯位移（>30%）、視角大改變、或物體物理狀態改變 → requiresEndFrame = true

【🔥 商品 / Logo 保護規則（最高優先級）】：
- 畫面核心是「特定商品」（手機、飲料、Logo、螢幕）且鏡頭為 Pan / Dolly / Orbit / Zoom / Rotate
  → **必須** requiresEndFrame = false
  （原因：避免首尾幀的 Logo 像素差異導致影片生成產生液化/果凍效應）
- 唯一例外：商品發生物理狀態改變（打開蓋子、倒液體、按壓變形、撕開包裝）→ 才可設 true

【與 transitionToNext 聯動】：
- transitionToNext.type = "continuation" → 可為 true 或 false（依實際需要）；若 false 則下一景沿用本景首幀或自動來源
- 非 continuation → 預設 false

【endFrameDescription / endFrameDelta 填寫規則】：
- requiresEndFrame = false → endFrameDescription 與 endFrameDelta **必須** 為空字串 ""
- requiresEndFrame = true：
  - endFrameDescription：撰寫「完整獨立場景描述」，從 description 複製環境、光線、構圖、色調、視角，只修改變化的元素
  - endFrameDelta：只描述「相對首幀」的改變，不可重寫整景
  - ❌ 禁止使用「同樣的」「相同角度」「依舊」等相對描述詞

範例：
- ❌ requiresEndFrame = false：雙人對話、特寫表情、商品 360° 旋轉、推近 Logo
- ✅ requiresEndFrame = true：鏡頭從室內推到室外、角色從畫面左側跑到右側消失、打開飲料罐蓋子
`;

export const SHARED_TRANSITION_STRATEGY_BLOCK = `
## 轉場策略（transitionToNext）

【類型說明】：
- cut：硬切 — 時空完全不同，無轉場效果（快節奏、促銷）
- dissolve：交叉溶解 — 同空間時間跳躍、情緒延續（品牌、抒情）
- fade_black：淡入黑場 — 段落分隔、結束語、轉折點
- fade_white：淡入白場 — 夢境/閃回結束、科技感、純淨感（美妝/科技）
- continuation：延續 — 下一景沿用此景畫面來源（優先尾幀，無尾可用首幀）
- match_cut：匹配剪接 — 形狀或動作相似的接續（球→月亮、眼睛→窗戶、產品→Logo）
- wipe：擦除 — 有方向感的畫面替換
- push：推出 — 新畫面推開舊畫面，動態感強

【判斷邏輯】：
a) 同一動作延續（同主體連續動作）→ type = "continuation"，useEndFrameAsNextStart = true
b) 同空間時間跳躍（白天→黑夜）→ type = "dissolve"，useEndFrameAsNextStart = false
c) 完全不同時空（換場景、換角色）→ type = "cut"，useEndFrameAsNextStart = false
d) 視覺形狀/動作相關 → type = "match_cut"，useEndFrameAsNextStart = false
e) 最後一場（作為結束）→ type = "fade_black"（情感收束）或 "fade_white"（科技/純淨）

必須在 transitionToNext.reason 說明選擇此轉場類型的原因。
`;

/**
 * Composed bundle that most templates can include verbatim.
 * Templates only need to add their unique creative strategy on top.
 */
export const SHARED_STORYBOARD_BLOCKS = [
  SHARED_SCENE_FIELDS_BLOCK,
  SHARED_HOOK_PATTERNS_BLOCK,
  SHARED_END_FRAME_JUDGMENT_BLOCK,
  SHARED_TRANSITION_STRATEGY_BLOCK,
].join('\n');
