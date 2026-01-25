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
  - 需要環境變數：`FAL_KEY` 或 `FAL_API_KEY`

- **`/api/fal/generate-image`** - 圖片生成
  - 處理圖片生成請求
  - 支援 localStorage API key 優先，環境變數備援

- **`/api/fal/generate-video`** - 影片生成
  - 處理影片生成請求（Kling / Seedance）
  - 支援 localStorage API key 優先，環境變數備援

- **`/api/fal/check-status`** - 狀態檢查
  - 檢查異步任務的執行狀態

### ⚠️ 已棄用

- **`/api/fal/upload`** - 舊的文件上傳代理（已被 Server Proxy 取代）
- **`/api/fal/upload-file`** - 舊的文件上傳（已被 Server Proxy 取代）

## 🔧 前端配置

前端在 `FalConfigProvider` 中自動配置 Fal Client：

```typescript
// 有 localStorage key
fal.config({ credentials: localApiKey });

// 沒有 localStorage key
fal.config({ proxyUrl: '/api/fal/proxy' });
```

## 🔑 API Key 優先順序

1. **前端 localStorage** - 用戶自己的 API key（優先）
2. **後端環境變數** - 伺服器的 API key（備援）
3. 兩者都沒有 → 返回錯誤

## 📚 相關文檔

- [Fal Server Proxy 文檔](https://fal.ai/docs)
- [前端配置](../../../components/providers/FalConfigProvider.tsx)
- [環境變數範例](../../../.env.local.example)
