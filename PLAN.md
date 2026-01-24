# 分鏡圖系統 (Storyboard System) 實作計畫

> **專案路徑**: `E:\claude-code\storyboard-system`
>
> 退出計畫模式後，此計畫將複製到專案資料夾中 (`PLAN.md`)

## 概述
建立一個完整的分鏡圖製作工作流系統，從文字生成分鏡腳本，到圖片、影片生成，最終輸出 Blender 自動剪輯腳本。

## 技術選型
- **框架**: Next.js 15 + TypeScript + React 19
- **樣式**: Tailwind CSS 4
- **狀態管理**: Zustand
- **UI 元件**: Radix UI
- **部署**: 本地運行

## API 整合
| 服務 | 用途 | 模型 |
|------|------|------|
| OpenRouter | 分鏡腳本生成 | Claude 3.5 Sonnet / GPT-4o |
| Fal AI | 圖片生成 | Nano Banana Pro |
| Fal AI | 影片生成 | Kling 2.6 Pro / Seedance 1.5 Pro |
| Gemini | 影片分析 | Gemini 2.5 Flash |

---

## 專案結構

```
storyboard-system/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # 首頁/專案列表
│   ├── globals.css
│   ├── project/[projectId]/
│   │   ├── page.tsx                  # 專案主頁
│   │   ├── storyboard/page.tsx       # 分鏡編輯
│   │   ├── images/page.tsx           # 圖片生成
│   │   ├── videos/page.tsx           # 影片生成
│   │   └── export/page.tsx           # 匯出/Blender
│   └── api/
│       ├── openrouter/generate-storyboard/route.ts
│       ├── fal/generate-image/route.ts
│       ├── fal/generate-video/route.ts
│       ├── fal/check-status/route.ts
│       ├── gemini/upload-video/route.ts
│       └── gemini/analyze-videos/route.ts
├── components/
│   ├── ui/                           # 基礎 UI 元件
│   ├── storyboard/                   # 分鏡表格元件
│   ├── image-generation/             # 圖片生成元件
│   ├── video-generation/             # 影片生成元件
│   └── export/                       # 匯出元件
├── lib/
│   ├── api/
│   │   ├── openrouter.ts
│   │   ├── fal.ts
│   │   └── gemini.ts
│   ├── prompts/
│   │   └── storyboard-templates.ts
│   ├── blender/
│   │   └── script-generator.ts
│   ├── types/
│   │   ├── project.ts
│   │   └── storyboard.ts
│   └── db/
│       └── local-storage.ts
├── stores/
│   └── project-store.ts
└── .env.local
```

---

## 實作步驟

### Phase 1: 專案初始化與基礎架構

**步驟 1.1: 建立 Next.js 專案**
```bash
npx create-next-app@latest storyboard-system --typescript --tailwind --app --src-dir=false
```

**步驟 1.2: 安裝依賴**
- `zustand` - 狀態管理
- `@google/generative-ai` - Gemini API
- `@radix-ui/react-*` - UI 元件
- `lucide-react` - 圖標

**步驟 1.3: 建立類型定義**
- `lib/types/storyboard.ts` - Scene, Storyboard, PromptTemplate
- `lib/types/project.ts` - Project, EditingSuggestion

**步驟 1.4: 建立 LocalStorage 持久化**
- `lib/db/local-storage.ts` - 專案資料 CRUD

**步驟 1.5: 建立 Zustand Store**
- `stores/project-store.ts` - 全域專案狀態

---

### Phase 2: 分鏡腳本生成

**步驟 2.1: OpenRouter API 封裝**
- `lib/api/openrouter.ts`
- 支援結構化 JSON 輸出
- 錯誤處理與重試

**步驟 2.2: 提示詞模板系統**
- `lib/prompts/storyboard-templates.ts`
- 預設模板：標準分鏡、廣告、MV

**步驟 2.3: API Route**
- `app/api/openrouter/generate-storyboard/route.ts`

**步驟 2.4: UI 元件**
- `components/storyboard/StoryPromptInput.tsx` - 故事輸入
- `components/storyboard/PromptTemplateSelector.tsx` - 模板選擇
- `components/storyboard/StoryboardTable.tsx` - 分鏡表格
- `components/storyboard/SceneRow.tsx` - 場景列

**步驟 2.5: 分鏡頁面**
- `app/project/[projectId]/storyboard/page.tsx`

---

### Phase 3: 分鏡圖片生成

**步驟 3.1: Fal AI API 封裝 (圖片)**
- `lib/api/fal.ts` - generateImage 函數
- 支援 Nano Banana Pro
- 支援參考圖上傳
- Queue 狀態輪詢

**步驟 3.2: API Routes**
- `app/api/fal/generate-image/route.ts`
- `app/api/fal/check-status/route.ts`

**步驟 3.3: UI 元件**
- `components/image-generation/ReferenceUploader.tsx`
- `components/image-generation/ImageGenerator.tsx`
- `components/image-generation/BatchImageGenerator.tsx`
- `components/image-generation/ImagePreview.tsx`

**步驟 3.4: 圖片頁面**
- `app/project/[projectId]/images/page.tsx`

---

### Phase 4: 影片生成

**步驟 4.1: Fal AI API 封裝 (影片)**
- `lib/api/fal.ts` - 新增 generateVideoKling, generateVideoSeedance

**步驟 4.2: API Route**
- `app/api/fal/generate-video/route.ts`

**步驟 4.3: UI 元件**
- `components/video-generation/ModelSelector.tsx` - Kling/Seedance 選擇
- `components/video-generation/MotionPromptEditor.tsx` - 動作提示詞
- `components/video-generation/VideoGenerator.tsx`
- `components/video-generation/VideoPreview.tsx`

**步驟 4.4: 影片頁面**
- `app/project/[projectId]/videos/page.tsx`

---

### Phase 5: 影片分析與 Blender 腳本

**步驟 5.1: Gemini API 封裝**
- `lib/api/gemini.ts`
- uploadVideoToGemini - Files API 上傳
- analyzeVideosForEditing - 影片分析

**步驟 5.2: API Routes**
- `app/api/gemini/upload-video/route.ts`
- `app/api/gemini/analyze-videos/route.ts`

**步驟 5.3: Blender 腳本生成器**
- `lib/blender/script-generator.ts`
- 生成影片片段添加代碼
- 生成轉場效果代碼
- 生成視覺效果代碼

**步驟 5.4: UI 元件**
- `components/export/VideoAnalyzer.tsx`
- `components/export/BlenderScriptViewer.tsx`
- `components/export/ExportControls.tsx`

**步驟 5.5: 匯出頁面**
- `app/project/[projectId]/export/page.tsx`

---

### Phase 6: 首頁與導航

**步驟 6.1: 專案列表**
- `app/page.tsx` - 專案卡片網格
- `components/project/ProjectCard.tsx`
- `components/project/CreateProjectDialog.tsx`

**步驟 6.2: 佈局與導航**
- `app/layout.tsx` - 全域佈局
- 步驟指示器 (腳本 > 圖片 > 影片 > 匯出)

**步驟 6.3: API 金鑰設定**
- `components/shared/ApiKeySettings.tsx`
- 儲存於 LocalStorage

---

## 核心資料結構

```typescript
// Scene 場景
interface Scene {
  id: string;
  sceneNumber: number;
  description: string;
  cameraMovement: string;
  dialogue: string;
  duration: number;
  notes?: string;
  referenceImage?: string;
  generatedImage?: { url: string; prompt: string; };
  motionPrompt?: string;
  generatedVideo?: { url: string; model: 'kling' | 'seedance'; };
}

// Project 專案
interface Project {
  id: string;
  name: string;
  storyboard?: Storyboard;
  blenderScript?: string;
  status: 'draft' | 'storyboard' | 'images' | 'videos' | 'complete';
}
```

---

## 環境變數 (.env.local)

```env
OPENROUTER_API_KEY=your_key
FAL_API_KEY=your_key
GEMINI_API_KEY=your_key
```

---

## 依賴套件

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@google/generative-ai": "^0.21.0",
    "zustand": "^5.0.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "lucide-react": "^0.400.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0"
  }
}
```

---

## 預計產出

1. 完整的 Next.js 應用程式
2. 5 個功能頁面（首頁、分鏡、圖片、影片、匯出）
3. 3 個 API 整合（OpenRouter、Fal AI、Gemini）
4. Blender Python 腳本生成器
5. LocalStorage 資料持久化
