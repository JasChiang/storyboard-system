# Storyboard System - 專案架構與流程總覽

此文件整理專案的整體架構、主要功能模組與使用流程，方便快速理解並規劃後續修改方向。

---

## 1) 專案定位與目標

Storyboard System 是一個 AI 驅動的分鏡工作流程工具，從「文字腳本 → 分鏡圖片 → 影片 → 匯出」一路串接，並提供參考圖一致性機制與可複用角色庫。

---

## 2) 核心資料模型（概念層）

- Project
  - Storyboard（分鏡腳本）
  - ProjectReferences（專案級參考圖）
- Scene（場景）
  - description / cameraMovement / dialogue / duration
  - endFrameDescription（尾幀）
  - generatedImage / generatedVideo
- ProjectReference（參考圖）
  - url / description / type / name / angle
  - guidelines（規則/限制，會拼進提示詞）
- CharacterLibraryItem（角色庫）
  - name / type / description / guidelines / tags
  - views[]（多視角圖 + AI 描述）

---

## 3) 主要模組與資料流

### A. 角色庫（Global Character Library）
路徑：
- UI：`/characters`
- 實作：`components/character-library/*`
- 儲存：`lib/db/character-library-storage.ts`（LocalStorage）
- 型別：`lib/types/character-library.ts`

功能：
- 可建立/編輯/刪除角色或商品/風格/環境
- 每個角色可上傳多視角圖片（front/side/3/4/back/top/other）
- 上傳即自動呼叫 AI 產生該視角描述
- 可輸入「角色規則/限制（guidelines）」並注入後續生成提示詞

輸出到分鏡：
- 由 `CharacterSelector` 將角色庫項目轉成 `ProjectReference`
- 可選角度；每次只選一個角度，但可重複加入不同角度

---

### B. 分鏡腳本生成（Storyboard）
路徑：
- UI：`app/project/[projectId]/storyboard`
- 輸入：`components/storyboard/StoryPromptInput.tsx`
- 參考圖管理：`components/storyboard/ProjectReferenceUploader.tsx`
- 提示詞構建：`lib/prompts/prompt-builder.ts`

功能：
- 使用模板 + 使用者故事描述生成分鏡腳本
- 參考圖會附帶到提示詞，要求使用 `<角色名>` 標記並避免重述外觀
- 參考圖來源可混用「角色庫」與「臨時上傳」

---

### C. 圖片生成（Image Generation）
路徑：
- UI：`app/project/[projectId]/images`
- 生成：`components/image-generation/ImageGenerator.tsx`
- 批次：`components/image-generation/BatchImageGenerator.tsx`

流程：
- 分鏡產生後，使用場景描述 + 參考圖描述生成圖像
- 會將「專案參考圖」的描述加入 `Context from references`
- 角色規則/限制（guidelines）會一起拼進提示詞
- 支援單張/批次，並可選參考圖集合

---

### D. 影片生成（Video Generation）
路徑：
- UI：`app/project/[projectId]/videos`
- 生成模型：Kling / Seedance（透過 Fal）

流程：
- 以場景圖片或描述生成短片
- 可加入動作提示詞

---

### E. 匯出（Export）
路徑：
- UI：`app/project/[projectId]/export`

功能：
- Gemini 影片分析（節奏/入出點/特效建議）
- 產生 Blender VSE 腳本
- Remotion 本地渲染（若有啟用）

---

## 4) API 與外部服務整合

API Routes：
- `app/api/openrouter/*`：腳本/參考圖 AI 分析
- `app/api/fal/*`：圖片 / 影片生成
- `app/api/gemini/*`：影片分析

外部服務：
- OpenRouter（腳本、參考圖描述）
- Fal AI（圖片/影片生成）
- Gemini（影片分析）

---

## 5) 專案結構（對應檔案）

```
app/
  api/                         # OpenRouter / Fal / Gemini API routes
  project/[projectId]/         # Storyboard / Images / Videos / Export 頁面
components/
  storyboard/                  # 分鏡輸入、參考圖、角色庫選擇器
  character-library/           # 角色庫管理（新增/編輯/選擇）
  image-generation/            # 圖片生成器與參考圖選擇
  video-generation/            # 影片生成流程
  export/                      # 影片分析與 Blender 輸出
lib/
  api/                         # OpenRouter / Fal / Gemini client
  prompts/                     # 提示詞模板與構建器
  types/                       # TypeScript 型別
  db/                          # LocalStorage 角色庫
stores/                        # Zustand 狀態管理
external/openreel-video/       # 編輯器子專案（已 vendor 進來）
```

---

## 6) 使用流程（整體）

1. 進入角色庫建立角色（多視角 + AI 描述 + 規則/限制）
2. 建立專案 → 輸入故事描述
3. 從角色庫選擇角色/商品/環境參考，必要時再上傳臨時參考圖
4. 生成分鏡腳本（含場景、運鏡、對話）
5. 進入圖片生成，選擇要使用的參考圖 → 生成場景圖
6. 進入影片生成，以圖片或描述生成短影片
7. 匯出：Remotion 或 Blender 腳本流程

---

## 7) 近期變更（關鍵）

- 角色庫新增「規則/限制（guidelines）」欄位
  - 會帶入分鏡提示詞與圖片生成提示詞
  - 位置：`components/character-library/CharacterCreateDialog.tsx`

---

## 8) 修改建議（下一步方向）

如果你要改功能，建議先決定「改哪個階段」：
- 想改腳本生成 → 看 `lib/prompts/*` + `app/api/openrouter/*`
- 想改圖片生成 → 看 `components/image-generation/*` + `app/api/fal/*`
- 想改角色庫 → 看 `components/character-library/*` + `lib/db/character-library-storage.ts`
- 想改整體流程 → 看 `app/project/[projectId]/*`

---

如需我基於這份文件再拆分成「技術設計 / 需求規格 / 功能清單」格式，直接告訴我你想要的版本。*** End Patch}}/>
