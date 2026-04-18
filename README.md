# 分鏡圖系統 (Storyboard System)

AI 驅動的分鏡製作工作流：從劇本大綱 → 分鏡腳本 → 圖片 → 影片 → Blender 剪輯腳本，一條線完成。

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8)

## 快速開始

```bash
npm install
cp .env.local.example .env.local   # 可選，也能在 UI 設定
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)。

### 需要的 API Key

| 用途 | 服務 | 取得 |
|---|---|---|
| 腳本生成 | OpenRouter (Claude) | [keys](https://openrouter.ai/settings/keys) |
| 圖片/影片生成 | Fal AI | [keys](https://fal.ai/dashboard/keys) |
| 影片分析 | Google Gemini | [keys](https://aistudio.google.com/app/apikey) |

## 使用流程

1. **建立專案** — 輸入名稱與描述
2. **腳本** — 輸入大綱、上傳參考圖（角色/商品/風格），AI 生成分鏡 JSON
3. **圖片** — 逐鏡或批次生成，參考圖自動注入一致性
4. **影片** — 關鍵鏡頭用 Kling / Seedance 生成動態片段
5. **匯出** — Gemini 視覺驗證 → 下載 Blender Python 腳本自動初剪

## 專案結構

```
app/            Next.js App Router
  api/          所有後端路由（openrouter / fal / gemini / workflow / ffmpeg）
  project/      專案工作台頁面
components/     UI 元件（依領域切分）
lib/
  api/          外部服務客戶端（fal, gemini, openrouter）
  prompts/      提示詞構造器 + 風格模板
  references/   參考圖一致性規則（identity lock、routing）
  storyboard/   分鏡全局連續性邏輯
  video/        各影片模型 adapter（kling, seedance）
  workflow/     QA 驗證、自動修復、任務佇列
stores/         Zustand 狀態管理
```

## 文件

詳細設計、整合、歷史紀錄都放在 [`docs/`](./docs)：

- [`docs/project-overview.md`](./docs/project-overview.md) — 架構總覽
- [`docs/quick-start.md`](./docs/quick-start.md) — 詳細上手
- [`docs/plan.md`](./docs/plan.md) — 產品與路線圖
- [`docs/implementation-guide.md`](./docs/implementation-guide.md) — 實作指南
- [`docs/export-system.md`](./docs/export-system.md) — 匯出系統
- [`docs/openreel-integration.md`](./docs/openreel-integration.md) — OpenReel 整合
- [`docs/video-prompt-schema-v1.md`](./docs/video-prompt-schema-v1.md) — 影片提示詞規格
- [`docs/integration-summary.md`](./docs/integration-summary.md) — 整合完成紀錄
- [`docs/change-notes.md`](./docs/change-notes.md) — 修正說明

## 技術堆疊

- **Frontend**: Next.js 15 App Router、React 19、TypeScript、Tailwind 4、Radix UI
- **State**: Zustand + LocalStorage / SQLite 雙層
- **AI**: `@fal-ai/client`、`@google/generative-ai`、自家 OpenRouter client

## 常見問題

- **Fal 錯誤** → 檢查 API Key 額度與參考圖 URL 有效性（Fal 暫存連結有時效）
- **Gemini 429** → 免費額度用盡，`.env.local` 切到 `gemini-1.5-flash`
- **Blender 腳本錯誤** → 需 Blender 5.0+（舊版 API 不同）

## 授權

MIT
