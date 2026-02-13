# Fal API Routes

## 🎯 架構概覽

本專案使用 **[@fal-ai/server-proxy](https://www.npmjs.com/package/@fal-ai/server-proxy)** 來安全地處理所有 Fal API 請求。

### 工作原理

```
前端 → /api/fal/proxy → Fal API
        ⬆️ 只代理請求，不代理文件數據（快速！）
```

## 📁 API Routes

### ✅ 使用中

- **`/api/fal/proxy`** - Server Proxy（推薦）
  - 處理所有 Fal API 請求（圖片生成、影片生成、文件上傳等）
  - 文件直接從瀏覽器上傳到 Fal，不經過伺服器
  - 需要環境變數：`FAL_API_KEY`

- **`/api/fal/generate-image`** - 圖片生成
  - 處理圖片生成請求
  - 使用伺服器端 `FAL_API_KEY`

- **`/api/fal/generate-video`** - 影片生成
  - 處理影片生成請求（Kling / Seedance）
  - 使用伺服器端 `FAL_API_KEY`

- **`/api/fal/check-status`** - 狀態檢查
  - 檢查異步任務的執行狀態

### ⚠️ 已移除

- `upload` 與 `upload-file` 路由已移除，避免誤用（改由 `/api/fal/proxy` 處理）

## 🔧 前端設定

前端在 `FalConfigProvider` 中固定使用 Proxy：

```typescript
fal.config({ proxyUrl: '/api/fal/proxy' });
```

## 🔑 API Key

- 僅使用伺服器端 `FAL_API_KEY`
- 前端不保存、不傳送 Fal API Key

## 📚 相關文檔

- [Fal Server Proxy 文檔](https://fal.ai/docs)
- [前端設定](../../../components/providers/FalConfigProvider.tsx)
- [環境變數範例](../../../.env.local.example)
- [Video Prompt Schema v1](../../../docs/video-prompt-schema-v1.md)
