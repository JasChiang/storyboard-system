# 分鏡圖系統 (Storyboard System)

一個完整的 AI 驅動分鏡圖製作工作流系統，從文字生成分鏡腳本、圖片、影片，到自動生成 Blender 剪輯腳本。

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)

## ✨ 主要功能

### 🎬 完整的分鏡製作流程

1. **分鏡腳本生成**
   - 使用 OpenRouter (Claude 3.5 Sonnet / GPT-4o) 從故事文字生成專業分鏡腳本
   - 結構化 JSON 輸出，包含場景描述、鏡頭運動、對話、時長等

2. **分鏡圖片生成**
   - 使用 Fal AI Nano Banana Pro 生成高品質分鏡圖片
   - 支援參考圖上傳、自訂提示詞
   - 單張或批次生成模式
   - 多種解析度 (1K/2K/4K) 和長寬比選項

3. **影片生成**
   - **Kling 2.6 Pro**: 5-10秒影片，支援 16:9/9:16/1:1
   - **Seedance 1.5 Pro**: 4-12秒影片，快速生成
   - 內建動作提示詞建議 (20+ 常用動作)
   - 圖片轉影片，支援音效/音頻

4. **影片分析與 Blender 腳本**
   - Gemini 2.0 Flash AI 分析影片內容
   - 自動生成入點/出點、轉場效果、視覺效果建議
   - 一鍵生成 Blender Python 剪輯腳本
   - 支援下載 .py 檔案直接在 Blender 中使用

## 🚀 快速開始

### 前置需求

- Node.js 18+ 
- npm 或 pnpm

### 安裝

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

開啟瀏覽器訪問 [http://localhost:3000](http://localhost:3000)

### API 金鑰設定

點擊右下角的設定按鈕，輸入以下 API 金鑰：

1. **OpenRouter API Key** - [獲取金鑰](https://openrouter.ai/settings/keys)
   - 用於分鏡腳本生成

2. **Fal AI API Key** - [獲取金鑰](https://fal.ai/dashboard/keys)
   - 用於圖片和影片生成

3. **Gemini API Key** - [獲取金鑰](https://aistudio.google.com/app/apikey)
   - 用於影片分析

> API 金鑰僅儲存在瀏覽器的 LocalStorage，不會上傳到伺服器

### 模型配置（選填）

您可以在 `.env.local` 檔案中自訂 AI 模型：

```bash
# 複製範例檔案
cp .env.local.example .env.local

# 編輯 .env.local 設定您想使用的模型
```

**可配置的模型**：

| 環境變數 | 說明 | 預設值 |
|---------|------|--------|
| `OPENROUTER_MODEL` | 分鏡腳本生成模型 | `anthropic/claude-3.5-sonnet` |
| `FAL_IMAGE_MODEL` | 圖片生成模型 | `fal-ai/nano-banana-pro` |
| `FAL_VIDEO_KLING_MODEL` | Kling 影片模型 | `fal-ai/kling-video/v2.6/pro/image-to-video` |
| `FAL_VIDEO_SEEDANCE_MODEL` | Seedance 影片模型 | `fal-ai/bytedance/seedance/v1.5/pro/image-to-video` |
| `GEMINI_MODEL` | 影片分析模型 | `gemini-2.0-flash-exp` |

**範例**：
```bash
# 使用 GPT-4o 生成分鏡腳本
OPENROUTER_MODEL=openai/gpt-4o

# 使用 Flux Pro 生成圖片
FAL_IMAGE_MODEL=fal-ai/flux-pro/v1.1

# 使用 Gemini 1.5 Pro 分析影片
GEMINI_MODEL=gemini-1.5-pro
```

> 參考模型列表：
> - [OpenRouter Models](https://openrouter.ai/models)
> - [Fal AI Models](https://fal.ai/models)
> - [Gemini Models](https://ai.google.dev/gemini-api/docs/models)

## 📁 專案結構

```
storyboard-system/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── openrouter/          # 分鏡腳本生成 API
│   │   ├── fal/                 # 圖片/影片生成 API
│   │   └── gemini/              # 影片分析 API
│   ├── project/[projectId]/     # 專案頁面
│   │   ├── storyboard/          # 分鏡編輯
│   │   ├── images/              # 圖片生成
│   │   ├── videos/              # 影片生成
│   │   └── export/              # Blender 匯出
│   └── page.tsx                 # 首頁
├── components/                   # React 元件
│   ├── storyboard/              # 分鏡相關元件
│   ├── image-generation/        # 圖片生成元件
│   ├── video-generation/        # 影片生成元件
│   ├── export/                  # 匯出相關元件
│   ├── project/                 # 專案管理元件
│   └── shared/                  # 共用元件
├── lib/                         # 工具函數
│   ├── api/                     # API 封裝
│   ├── blender/                 # Blender 腳本生成器
│   ├── types/                   # TypeScript 類型定義
│   ├── prompts/                 # 提示詞模板
│   └── db/                      # LocalStorage 封裝
└── stores/                      # Zustand 狀態管理
```

## 🛠 技術棧

### 核心框架
- **Next.js 15** - React 框架
- **React 19** - UI 框架
- **TypeScript** - 類型安全

### 樣式
- **Tailwind CSS 4** - 工具類 CSS 框架
- 深色主題設計

### 狀態管理
- **Zustand** - 輕量級狀態管理
- **LocalStorage** - 資料持久化

### AI 服務整合
- **OpenRouter** - LLM API 聚合服務
- **Fal AI** - 圖片/影片生成
- **Google Gemini** - 影片分析

### UI 元件
- **Radix UI** - 無頭 UI 元件
- **Lucide React** - 圖標庫

## 📖 使用流程

### 1. 建立專案
在首頁點擊「新專案」，輸入專案名稱和描述

### 2. 生成分鏡腳本
- 在分鏡編輯頁面輸入故事描述
- 選擇提示詞模板（標準分鏡、廣告、MV 等）
- AI 自動生成完整的分鏡表格

### 3. 生成分鏡圖片
- 選擇單張或批次生成模式
- 可上傳參考圖、自訂提示詞
- 設定解析度和長寬比
- 等待生成完成（約 30 秒/張）

### 4. 生成影片
- 選擇 Kling 或 Seedance 模型
- 編輯動作提示詞（可使用內建建議）
- 設定影片時長、長寬比等參數
- 等待生成完成（約 3-5 分鐘/段）

### 5. 匯出 Blender 腳本
- AI 分析所有影片片段
- 生成剪輯建議（入出點、轉場、特效）
- 下載 Blender Python 腳本
- 在 Blender 中執行自動剪輯

## 🎨 設計特色

- **深色主題** - 專業的影片製作風格
- **響應式設計** - 支援各種螢幕尺寸
- **即時預覽** - 圖片/影片即時預覽
- **進度追蹤** - 清楚的生成進度指示
- **智能提示** - 引導式操作流程

## 📝 授權

MIT License

## 🙏 致謝

- [Next.js](https://nextjs.org/)
- [OpenRouter](https://openrouter.ai/)
- [Fal AI](https://fal.ai/)
- [Google Gemini](https://ai.google.dev/)
- [Blender](https://www.blender.org/)

---

**打造專業分鏡圖，從故事到影片，一氣呵成！** 🎬✨
