# 分鏡圖系統 (Storyboard System)

一個完整的 AI 驅動分鏡圖製作工作流程系統，從文字生成分鏡腳本、圖片、影片，到自動生成 Blender 剪輯腳本。整合了 Claude 3.5 Sonnet、Fal AI (Flux/Kling/Seedance) 與 Gemini 2.0 Flash 等頂尖 AI 模型。

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)
![Fal AI](https://img.shields.io/badge/Fal_AI-SDK-purple)

## ✨ 主要功能

### 1. 📝 智慧分鏡腳本 (AI Storyboard Script)
- **支援多模型**：整合 OpenRouter，支援 Claude 3.5 Sonnet / 4.5 Sonnet (推薦) 等。
- **參考圖 AI 系統 (Reference Image AI)**：
  - 上傳角色、商品、環境或風格參考圖。
  - **自動一致性注入**：AI 會自動識別參考圖，並在生成腳本時使用 `<CharacterName>` 標籤確保角色一致性。
  - **智慧描述最佳化**：自動過濾多餘的外觀描述，專注於動作與構圖，避免與參考圖衝突。
- **專業模板**：內建標準分鏡、廣告短片、音樂錄影帶 (MV) 等多種腳本模板。
- **結構化輸出**：生成包含場景描述、運鏡指示、對話與時長的標準 JSON 格式。

### 2. 🎨 一致性圖片生成 (Consistent Image Generation)
- **Fal AI SDK 整合**：採用官方 `@fal-ai/client` SDK，提供更穩定的生成體驗與錯誤處理。
- **Flux / Nano Banana Pro 模型**：產生高品質、風格統一的分鏡圖片。
- **參考圖驅動 (Image-to-Image)**：
  - 支援上傳參考圖進行風格遷移或角色固定。
  - 自動處理參考圖與提示詞的權重平衡。
- **批次生成**：支援一鍵產生所有場景圖片，並具備自動重試機制。
- **多規格支援**：提供 16:9、9:16、1:1 等多種比例及 1K/2K/4K 解析度。

### 3. 🎥 AI 影片生成 (AI Video Generation)
- **Kling 2.6 Pro**：生成高品質、物理準確的 5-10 秒影片 (720p/1080p)。
- **Seedance 1.5 Pro**：快速生成 4-12 秒動態影片。
- **動作提示詞輔助**：內建 20+ 種常用運鏡與動作提示詞 (Zoom In/Out, Pan, Tilt 等)。
- **圖生影 (Image-to-Video)**：基於分鏡圖片生成影片，確保畫面連貫性。

### 4. 🎬 智慧剪輯與匯出 (Smart Export & Blender)
- **Gemini 3.0 Flash 影片分析**：
  - 視覺確認 (Visual Confirmation)：AI 自動確認影片內容是否符合腳本描述。
  - 剪輯建議：自動標記最佳入點 (In-point) 與出點 (Out-point)。
  - 特效建議：根據畫面氛圍建議調色、發光、模糊或速度控制。
  - 可自行更換模型
- **Blender 5.0 Python 腳本生成**：
  - 自動產生完整的 Blender VSE (Video Sequence Editor) 剪輯腳本。
  - **自動化處理**：自動下載影片、建立軌道、添加轉場 (Crossfade/Gamma Cross) 與特效。
  - **Headless 模式**：支援背景執行與自動算圖 (Render)。

## 🚀 快速開始

### 系統需求
- Node.js 18+
- npm 或 pnpm
- Blender 5.0+ (用於執行匯出的剪輯腳本)

### 安裝與執行

```bash
# 1. 安裝相依套件
npm install

# 2. 設定環境變數 (可選，或在 UI 中設定)
cp .env.local.example .env.local

# 3. 啟動開發伺服器
npm run dev
```

開啟瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

### API 金鑰設定
首次使用請點擊介面右下角的「API 設定」或在 `.env.local` 中設定：

1. **OpenRouter API Key** (腳本生成): [取得金鑰](https://openrouter.ai/settings/keys)
2. **Fal AI API Key** (圖片/影片生成): [取得金鑰](https://fal.ai/dashboard/keys)
3. **Gemini API Key** (影片分析): [取得金鑰](https://aistudio.google.com/app/apikey)

## 📖 使用流程

1.  **建立專案**：輸入專案名稱與描述。
2.  **腳本製作**：
    -   輸入故事大綱。
    -   **(選填) 上傳參考圖**：上傳角色或風格圖片，AI 將自動鎖定角色外觀。
    -   生成並編輯分鏡腳本。
3.  **圖片生成**：檢查 AI 生成的圖片提示詞，選擇單張或批次生成圖片。
4.  **影片生成**：選擇關鍵場景生成動態影片，調整動作提示詞以獲得最佳效果。
5.  **匯出剪輯**：
    -   執行 Gemini 影片分析。
    -   下載 `.py` 腳本。
    -   在 Blender 中執行腳本，自動完成初剪。

## 📁 專案結構

```
storyboard-system/
├── app/
│   ├── api/                      # Next.js API Routes (OpenRouter, Fal, Gemini)
│   ├── project/[projectId]/      # 專案各階段頁面 (Storyboard, Images, Videos, Export)
│   └── page.tsx                  # 首頁/專案列表
├── components/
│   ├── storyboard/               # 分鏡表與參考圖上傳元件
│   ├── image-generation/         # 圖片生成與預覽元件
│   ├── video-generation/         # 影片生成控制元件
│   └── export/                   # 影片分析與 Blender 腳本檢視器
├── lib/
│   ├── api/                      # API Client 封裝 (fal.ts, openrouter.ts, gemini.ts)
│   ├── blender/                  # Blender Python 腳本生成邏輯
│   ├── prompts/                  # 提示詞構建器與模板
│   └── types/                    # TypeScript 類型定義
└── stores/                       # Zustand 狀態管理 (Project Store)
```

## 🛠 技術堆疊

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4, Radix UI, Lucide React
- **State Management**: Zustand, LocalStorage Persistence
- **AI Integration**:
  - `@fal-ai/client` (Fal AI SDK)
  - `@google/generative-ai` (Gemini SDK)
  - Custom OpenRouter Client

## ⚠️ 常見問題

- **Fal API 錯誤**: 請確認 API Key 是否有足夠額度，並檢查圖片 URL 是否過期 (Fal 暫存連結有時效性)。
- **Gemini 429 錯誤**: 免費版配額耗盡，建議在 `.env.local` 切換至 `gemini-1.5-flash` 模型。
- **Blender 腳本錯誤**: 此腳本專為 **Blender 5.0+** 設計，舊版 (3.x/4.x) 可能因 API 差異 (如 `file_format='FFMPEG'`) 而無法執行。

## 授權
MIT License

---
**Storyboard System** - 讓 AI 成為你的分鏡導演。
