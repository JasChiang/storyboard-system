# 影片匯出系統說明文檔

本系統提供三種影片匯出方式，全部採用開源免費方案，適合商業使用。

## 🎯 三種匯出方式

### 1. 時間軸可視化編輯 (推薦)

**適用場景**: 需要調整場景順序、修改時長、刪除場景

**功能特性**:
- 🎬 拖拽場景卡片調整順序
- ⏱️ 點擊場景後可調整時長
- ✂️ 選中場景後可刪除
- 💾 保存編輯結果
- 🎥 直接匯出為影片

**使用流程**:
1. 在匯出頁面選擇「時間軸可視化編輯」
2. 拖拽場景卡片調整順序
3. 點擊場景查看詳細設置，調整時長
4. 保存編輯結果
5. 點擊「匯出影片」按鈕渲染

**技術實現**:
- 組件: `components/export/TimelineEditor.tsx`
- 自定義拖拽時間軸界面
- 場景預覽縮圖
- 即時統計資訊顯示

---

### 2. FFmpeg 快速渲染

**適用場景**: 快速自動渲染，無需手動編輯

**功能特性**:
- ⚡ 自動場景拼接
- 🎬 淡入淡出轉場效果
- 📝 字幕自動疊加
- 🎥 H.264 編碼，1080p 輸出
- 📊 即時進度追蹤
- 🎞️ 在線預覽和下載

**使用流程**:
1. 確保至少有一個場景生成了圖片或影片
2. 點擊「開始渲染」按鈕
3. 等待渲染完成（會顯示進度條）
4. 渲染完成後在線預覽
5. 點擊「下載影片」保存到本地

**技術實現**:
- API: `app/api/ffmpeg/render/route.ts`
- 組件: `components/export/FFmpegRenderer.tsx`
- 使用 fluent-ffmpeg 和 @ffmpeg-installer/ffmpeg
- 自動下載素材、轉換、合併、加入字幕

**渲染流程**:
```
1. 下載所有場景素材到臨時目錄
2. 將圖片轉換為影片片段（如果需要）
3. 生成 SRT 字幕文件
4. 使用 FFmpeg xfade 濾鏡加入轉場
5. 疊加字幕
6. 輸出最終影片
7. 清理臨時文件
```

---

### 3. Blender 專業匯出

**適用場景**: 需要在 Blender 中進行專業級精細調整

**功能特性**:
- 🎨 AI 影片分析
- 📜 生成 Blender Python 腳本
- 🎬 支援場景編輯建議
- 🔧 完全控制和高級調色

**使用流程**:
1. 步驟 1: 運行 AI 影片分析
2. 步驟 2: 下載生成的 Blender Python 腳本
3. 在 Blender 中執行腳本
4. 手動精修和調色

**技術實現**:
- 組件: `components/export/VideoAnalyzer.tsx`
- 組件: `components/export/BlenderScriptViewer.tsx`
- 使用 Gemini API 分析場景
- 生成場景編輯建議

---

## 📁 文件結構

```
storyboard-system/
├── app/
│   └── api/
│       └── ffmpeg/
│           └── render/
│               └── route.ts           # FFmpeg 渲染 API
│
├── components/
│   └── export/
│       ├── TimelineEditor.tsx         # 時間軸編輯器
│       ├── FFmpegRenderer.tsx         # FFmpeg 渲染器 UI
│       ├── VideoAnalyzer.tsx          # Blender AI 分析
│       └── BlenderScriptViewer.tsx    # Blender 腳本查看器
│
├── lib/
│   └── utils/
│       └── timeline-converter.ts      # 時間軸數據轉換工具
│
└── public/
    └── renders/                       # FFmpeg 渲染輸出目錄
```

---

## 🔧 依賴套件

### FFmpeg 渲染
```json
{
  "@ffmpeg-installer/ffmpeg": "^1.1.0",
  "@types/fluent-ffmpeg": "^2.1.28",
  "fluent-ffmpeg": "^2.1.3"
}
```

### 時間軸編輯器
```json
{
  "@xzdarcy/react-timeline-editor": "latest"
}
```
（註：實際使用了自定義實現，不依賴此套件的複雜 API）

---

## 💡 最佳實踐

### 推薦工作流程

1. **創建分鏡腳本** → 生成場景描述
2. **生成圖片** → 為每個場景生成視覺素材
3. **生成影片** → 將圖片轉換為動態影片（可選）
4. **選擇匯出方式**:
   - 需要調整？→ 使用時間軸編輯器
   - 快速完成？→ 使用 FFmpeg 快速渲染
   - 專業製作？→ 使用 Blender 匯出

### 場景素材要求

- **最低要求**: 至少一個場景有圖片或影片
- **推薦**: 所有場景都有影片素材，效果最佳
- **圖片轉影片**: FFmpeg 會自動將圖片轉換為靜態影片片段

---

## 🚀 未來改進計劃

- [ ] 加入更多轉場效果（Dissolve, Slide, Zoom）
- [ ] 支援背景音樂加入
- [ ] 字幕樣式自定義（字體、顏色、位置）
- [ ] 實時預覽功能
- [ ] 渲染隊列管理
- [ ] 匯出多種分辨率（720p, 1080p, 4K）
- [ ] 場景特效（Ken Burns, Zoom）

---

## 📝 授權說明

所有使用的開源套件均為 MIT 授權，可免費商用：
- ✅ FFmpeg - LGPL/GPL（二進制分發免費）
- ✅ fluent-ffmpeg - MIT License
- ✅ Next.js - MIT License
- ✅ React - MIT License

---

## 🐛 已知問題

### FFmpeg 渲染
- 渲染大型項目（>10 場景）可能需要較長時間
- 臨時文件存儲在 `temp/` 目錄，渲染完成後自動清理

### 時間軸編輯器
- 拖拽時可能需要精確定位
- 建議使用電腦而非移動設備

---

## 📞 技術支援

如遇問題，請檢查：
1. 所有場景是否有素材（圖片或影片）
2. FFmpeg 是否正確安裝（會自動安裝）
3. 瀏覽器控制台是否有錯誤訊息
4. 服務器日誌中的詳細錯誤資訊

---

**更新日期**: 2026-01-30
**版本**: 1.0.0
