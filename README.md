# 分鏡圖系統 (Storyboard System)

一個完整的 AI 驅動分鏡製作工作流程：從文字生成分鏡腳本、分鏡圖、影片、旁白與配樂，到自動產生 Blender 剪輯腳本與內嵌時間軸編輯。整合 OpenRouter（Claude）、Fal AI（GPT Image 2 / Seedream / Seedance 2.0）與 Google Gemini 等模型，核心特色是**跨角色／商品的一致性鎖定**。

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Fal AI](https://img.shields.io/badge/Fal_AI-SDK-purple)
![License](https://img.shields.io/badge/License-MIT-green)

> ℹ️ 影片生成目前統一使用 **Seedance 2.0**（已移除舊版 Kling 路徑）；預設圖片模型為 **GPT Image 2**。

## ✨ 主要功能

### 1. 📝 智慧分鏡腳本 (AI Storyboard Script)
- **多模型支援**：透過 OpenRouter 介接，預設 `anthropic/claude-sonnet-4.6`，可用 `OPENROUTER_MODEL` 切到 `anthropic/claude-opus-4.8` 等。
- **結構化輸出 contract**：以 JSON Schema 約束輸出，每個 scene 含描述、運鏡、`sceneIntent`、`startComposition`、`continuityLock`、`hookScore`、`videoMode` 等欄位，降低 schema drift。
- **參考圖一致性注入**：自動辨識上傳的角色／商品／環境／風格參考圖，並以 `<標籤>`（如 `<Alice>`、`<iPhone>`）在腳本中鎖定一致性；自動過濾多餘外觀描述，專注動作與構圖。
- **影片模式判定 (`videoMode`)**：每鏡自動分類為 `standard`（圖生影，需首幀）／`reference`（多模態參考生影）／`text`（純文字生影）。
- **Production 欄位**：每鏡可記錄 `renderLane`、`productionRisk`、`deliveryIntent`、`reservedForPost`、`referencePriorityMode`。
- **共用連續性**：分鏡層級可設定 `sharedAnchors` 與 `sharedContinuityDirectives`，自動帶進圖片／影片提示詞。
- **內建模板**：`default`（標準分鏡）、`commercial`（廣告短片）、`music_video`（MV）、`documentary`（紀錄片）、`shorts_hook`（短影音 Hook）、`tech_product`（科技產品）。
- **品質校正**：第一輪生成後，僅在偵測到一致性違規或首場 Hook 偏弱時才觸發第二輪 LLM 修正，兼顧品質與成本。

### 2. 🧬 全局角色庫 v2 (Character Library)
可重複使用的 IP 角色／商品／風格資源庫，採結構化身份 schema 對抗生成漂移 (identity drift)：
- **`identityAnchor`**：一句話身份錨點，放在 prompt 第一句。
- **`renderingMedium`**：渲染媒介（flat_2d / cel_3d / clay_3d / photoreal …），防止模型自動把扁平吉祥物 3D 化或寫實化。
- **`driftHotspots`**：部位級別的常見失敗清單（如手、腳、眼睛），展開成結構化負面指令。
- **`actionSafety`**：動作安全表（禁用動詞、改寫規則、解剖約束），規避觸發錯誤 prior 的描述。
- **`featureVariants`**：雙層特徵（外層身份鎖定不可變 + 內層隨 mood 切換），可在表情變化時只改內層。
- **多視角參考**：front / side / side_left / side_right / three_quarter / back / top，並依場景視角需求自動路由最合適的參考圖。
- **批次分析**：可上傳多視角角色圖，由 vision 模型一次推導出上述 v2 結構化欄位。

### 3. 🎨 一致性圖片生成 (Consistent Image Generation)
- **Fal AI SDK 整合**：採用官方 `@fal-ai/client`，伺服器端代理金鑰，前端不保存。
- **預設 GPT Image 2 (OpenAI)**：可在 UI 切換 Seedream 5.0 Lite；支援 `low / medium / high` 品質控制。
- **參考圖驅動 (Image-to-Image)**：有參考圖時自動走 edit endpoint，平衡參考圖與提示詞權重。
- **批次生成**：一鍵產生所有場景圖片並具自動重試；`reference` / `text` 模式的場景會自動略過圖片階段。
- **多規格**：16:9 / 9:16 / 1:1 等比例，1K / 2K / 4K 解析度。

### 4. 🎥 AI 影片生成 (Seedance 2.0)
- **三種生成模式**，各含 fast 變體（fast 上限 720p，會自動降版）：
  - **Image-to-Video** (`v20_i2v` / `v20_i2v_fast`)：以分鏡圖為首幀生成。
  - **Reference-to-Video** (`v20_ref` / `v20_ref_fast`)：多模態參考（最多 9 張圖 + 影片 + 音訊），以 `@图片N`／`@视频N`／`@音频N` token 綁定身份／運鏡／音色。
  - **Text-to-Video** (`v20_t2v` / `v20_t2v_fast`)：純文字生成，不需首幀。
- **動作提示詞輔助**：內建常用運鏡與動作提示（Zoom / Pan / Tilt …）。
- **提示詞策略**：自動套用長度上限與身份鎖定保護（截斷時優先保留 `@token` 身份子句）。

### 5. 🔊 旁白與配樂 (Voiceover & Music)
- **旁白 (TTS)**：Index TTS 2，可帶情緒強度與聲音參考。
- **配樂**：ElevenLabs Music 或 MiniMax Music v2，依分鏡氛圍生成背景音樂。

### 6. 🎬 智慧剪輯與匯出 (Smart Export & Blender)
- **Gemini 影片分析**（預設 `gemini-2.5-flash`）：視覺確認影片是否符合腳本、標記最佳入／出點、建議調色與特效。
- **Blender 5.0 Python 腳本生成**：自動產生 VSE 剪輯腳本（下載影片、建立軌道、加轉場與特效），支援 Headless 算圖。

### 7. 🧵 內嵌時間軸編輯 (OpenReel)
專案內嵌自架的 [OpenReel](https://github.com/openreel) 線上時間軸編輯器（位於 `external/openreel-video/`，第三方 MIT 授權，見下方〈第三方元件〉與 `OPENREEL_INTEGRATION.md`）。

## 🚀 快速開始

### 系統需求
- Node.js 18.18+（建議 20 LTS 以上）
- npm / pnpm
- Blender 5.0+（執行匯出的剪輯腳本時需要，選用）

### 安裝與執行
```bash
# 1. 安裝相依套件
npm install

# 2. 設定環境變數（可選，也可在 UI 中設定金鑰）
cp .env.local.example .env.local

# 3. 啟動開發伺服器
npm run dev
```
開啟 [http://localhost:3000](http://localhost:3000)。

### 必要 API 金鑰
首次使用可在介面右下角「API 設定」或於 `.env.local` 設定：

| 變數 | 用途 | 取得 |
|---|---|---|
| `OPENROUTER_API_KEY` | 分鏡腳本生成 | <https://openrouter.ai/settings/keys> |
| `FAL_API_KEY` | 圖片 / 影片 / 音訊生成 | <https://fal.ai/dashboard/keys> |
| `GEMINI_API_KEY` | 影片分析 | <https://aistudio.google.com/app/apikey> |

### 常用選用變數
| 變數 | 預設 | 說明 |
|---|---|---|
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4.6` | 分鏡腳本模型（可改 `anthropic/claude-opus-4.8`） |
| `OPENROUTER_VISION_MODEL` | `google/gemini-3.5-flash` | 參考圖分析模型 |
| `FAL_IMAGE_MODEL` | `openai/gpt-image-2` | 圖片生成 endpoint |
| `FAL_VIDEO_SEEDANCE_MODELS` | 內建預設 | Seedance variant→endpoint JSON 覆寫（key：`v20_i2v` / `v20_i2v_fast` / `v20_ref` / `v20_ref_fast` / `v20_t2v` / `v20_t2v_fast`） |
| `GEMINI_MODEL` | `gemini-3.5-flash` | 影片分析 + 圖片/影片提示詞合成（Google 直連） |
| `GEMINI_PROMPT_COMPOSER_MODEL` | 同 `GEMINI_MODEL` | 僅覆寫提示詞合成用的 Gemini 模型 |
| `APP_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN` | `http://localhost:3000` | 非預設 origin 時設定 |

完整清單見 `.env.local.example`。

## 📖 使用流程
1. **建立專案**：輸入名稱與描述。
2. **腳本製作**：輸入故事大綱 →（選填）上傳角色／商品參考圖 → 生成並編輯分鏡腳本。
3. **圖片生成**：檢查 AI 提示詞，單張或批次生成分鏡圖（`reference`／`text` 模式場景會略過此步）。
4. **影片生成**：選擇場景與 Seedance 模式（i2v／reference／text）生成動態影片。
5. **旁白／配樂**（選填）：生成 TTS 旁白與背景音樂。
6. **匯出剪輯**：執行 Gemini 影片分析 → 下載 `.py` → 在 Blender 執行自動初剪，或在內嵌 OpenReel 編輯器微調。

## 📁 專案結構
```
storyboard-system/
├── app/
│   ├── api/                      # Next.js API Routes (OpenRouter / Fal / Gemini)
│   ├── characters/               # 全局角色庫頁面
│   ├── project/[projectId]/      # 專案各階段頁面 (Storyboard / Images / Videos / Export)
│   └── page.tsx                  # 首頁 / 專案列表
├── components/
│   ├── character-library/        # 角色庫建立與選用元件
│   ├── storyboard/               # 分鏡表與參考圖上傳
│   ├── image-generation/         # 圖片生成與預覽
│   ├── video-generation/         # 影片生成控制
│   └── export/                   # 影片分析與 Blender 腳本檢視
├── lib/
│   ├── api/                      # API client (fal.ts / openrouter.ts / gemini.ts)
│   ├── blender/                  # Blender Python 腳本生成
│   ├── prompts/                  # 提示詞構建器、模板、storyboard contract
│   ├── references/               # 參考圖一致性 / 身份鎖定 / 視角路由
│   ├── video/                    # Seedance 影片提示詞 adapter
│   └── types/                    # TypeScript 型別定義
├── stores/                       # Zustand 狀態管理
└── external/openreel-video/      # 內嵌 OpenReel 編輯器（第三方，MIT）
```

## 🛠 技術堆疊
- **Frontend**：Next.js 15 (App Router)、React 19、TypeScript 5
- **Styling**：Tailwind CSS 4、Radix UI、Lucide React
- **State**：Zustand + LocalStorage persistence
- **AI 整合**：
  - `@fal-ai/client` / `@fal-ai/server-proxy`（圖片 / 影片 / 音訊）
  - `@google/genai`（Gemini）
  - 自製 OpenRouter client（分鏡腳本）

## 🧩 第三方元件
- **`external/openreel-video/`** — [OpenReel](https://github.com/openreel) 線上影片編輯器，**MIT License**（Copyright © 2024–2026 Augustus Otu and Contributors）。其授權聲明保留於 `external/openreel-video/LICENSE`；整合方式見 `OPENREEL_INTEGRATION.md`。

## ⚠️ 常見問題
- **Fal API 錯誤**：確認金鑰額度，並注意 Fal 暫存圖片連結有時效性。
- **Gemini 429（配額耗盡）**：在 `.env.local` 將 `GEMINI_MODEL` 改為 `gemini-3.1-flash-lite`（較省）或維持 `gemini-3.5-flash`（較高品質）。
- **Blender 腳本錯誤**：腳本專為 **Blender 5.0+** 設計，舊版 (3.x/4.x) 可能因 API 差異無法執行。
- **Seedance fast 變體只能 720p**：選 fast 時若指定 1080p 會自動降為 720p。

## 📄 授權
MIT License（本專案）。第三方元件之授權見〈第三方元件〉。

---
**Storyboard System** — 讓 AI 成為你的分鏡導演。
