# 實現指南 - 角色庫 + Remotion

## 🎯 已完成功能

### ✅ 任務 #1: 全局角色庫基礎
- [x] 資料類型定义 (`lib/types/character-library.ts`)
- [x] 本地儲存管理器 (`lib/db/character-library-storage.ts`)
- [x] 角色庫管理頁面 (`app/characters/page.tsx`)
- [x] 首頁增加「角色庫」入口

**造訪方式**: http://localhost:3000/characters

### ✅ 任務 #3: Remotion 基礎架构
- [x] 安裝依赖設定 (`package.json`)
- [x] Remotion 設定 (`remotion.config.ts`)
- [x] 影片组件结构 (`remotion/` 目錄)
  - `Root.tsx` - 根组件
  - `StoryboardVideo.tsx` - 主影片合成
  - `SceneComponent.tsx` - 場景渲染
  - `TransitionComponent.tsx` - 轉場效果
- [x] 本地渲染 API (`app/api/remotion/render/route.ts`)

---

## 🚀 立即開始

### 1. 安裝依赖

```bash
npm install
```

這會安裝：
- `remotion` - Remotion 核心庫
- `@remotion/cli` - 命令行工具
- `@remotion/bundler` - 打包工具
- `@remotion/renderer` - 渲染引擎

### 2. 啟動開發伺服器

```bash
npm run dev
```

### 3. 測試角色庫

1. 造訪 http://localhost:3000
2. 點擊右上角「角色庫」按鈕
3. 目前顯示空狀態（建立功能待完成）

### 4. 測試 Remotion 渲染（可選）

```bash
# 開啟 Remotion Studio（視覺化預覽）
npm run remotion:studio

# 或直接渲染（需要先有專案資料）
npm run remotion:render
```

---

## 📋 待完成任務

### 🔨 任務 #2: 增強角色選擇功能
**預計时间**: 20分鐘

需要實現：
1. 建立角色建立/編輯對話框组件
2. 修改 `StoryPromptInput` 增加「從角色庫選擇」按鈕
3. 建立角色選擇器對話框
4. 實現「將暫時角色加入庫」功能

**文件清單**:
- `components/character-library/CharacterCreateDialog.tsx` (新建)
- `components/character-library/CharacterSelector.tsx` (新建)
- `components/storyboard/StoryPromptInput.tsx` (修改)

### 🎬 任務 #4: Remotion 合成優化
**預計时间**: 30分鐘

需要改善：
1. 支援更多轉場效果
2. 優化字幕顯示樣式
3. 加入背景音樂軌道（可選）
4. Ken Burns 效果參數调整

### 🎨 任務 #5: 匯出頁面双模式
**預計时间**: 30分鐘

需要實現：
1. 在 `app/project/[projectId]/export/page.tsx` 增加渲染模式選擇
2. 建立 Remotion 渲染按鈕
3. 顯示渲染進度
4. 保留原有 Blender 腳本匯出功能

---

## 🔥 使用場景对比

### 場景 A：既有 IP 角色（推薦角色庫）
```
工作流程：
1. 預先在角色庫上傳公司吉祥物多視角圖
2. 建立新專案时從角色庫選擇角色
3. AI 自動引用角色生成劇本
4. 生成圖片/影片时保持角色一致性
```

**適用**: 公司IP、長期使用的角色、多專案重複使用

### 場景 B：一次性角色（保留暫時上傳）
```
工作流程：
1. 建立專案
2. 在分鏡腳本頁面暫時上傳參考圖
3. 生成完成後可選擇「加入角色庫」
```

**適用**: 單次專案、測試角色、不常用資源

---

## 🎯 Remotion vs Blender 選擇建議

### 使用 Remotion（快速渲染）当：
- ✅ 需要快速出片（一鍵渲染）
- ✅ 轉場簡單（Cut/Dissolve/Fade）
- ✅ 不需要複雜特效
- ✅ 希望在程式碼中管理影片邏輯

### 使用 Blender（專業匯出）当：
- ✅ 需要複雜特效（Compositor）
- ✅ 需要手動精修
- ✅ 需要高級調色
- ✅ 已有 Blender 工作流程

**建議**: 兩者共存，给使用者選擇權！

---

## 💡 快速測試建議

### 測試角色庫
```bash
# 1. 啟動服務
npm run dev

# 2. 造訪角色庫頁面
# http://localhost:3000/characters

# 3. 嘗試建立第一個角色（待實作建立對話框）
```

### 測試 Remotion 渲染
```bash
# 1. 建立測試專案並生成分鏡
# 2. 生成至少2個場景的圖片或影片
# 3. 在匯出頁面呼叫 Remotion 渲染 API（待實作UI）

# 或使用 Remotion Studio 預覽：
npm run remotion:studio
```

---

## 🐛 已知限制

1. **角色庫建立對話框**: 目前是佔位符，需要實現完整的多視角上傳功能
2. **Remotion 渲染按鈕**: Export 頁面尚未整合，需要手動呼叫 API
3. **渲染進度顯示**: 目前只在伺服器日誌，需要實現實时進度通知
4. **影片下載**: 渲染完成後需要從 `/renders/` 目錄手動取得

---

## 📚 參考资料

- [Remotion 官方文件](https://www.remotion.dev/docs)
- [Remotion 本地渲染](https://www.remotion.dev/docs/renderer)
- [Fal AI 文件](https://fal.ai/docs)

---

## 🤝 下一步行动

**立即可做**:
1. 运行 `npm install` 安裝新依赖
2. 測試角色庫頁面造訪
3. 繼續實現任務 #2（角色建立功能）

**並行開發**:
- 前端：完成角色建立對話框和選擇器
- 後端：Remotion 渲染 API 已就绪
- 整合：Export 頁面加入 Remotion 渲染按鈕

需要我繼續實現剩餘任務嗎？
