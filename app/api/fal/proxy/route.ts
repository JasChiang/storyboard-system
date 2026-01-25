// 這個 proxy endpoint 會安全地處理所有 Fal API 請求
// 前端可以直接呼叫 Fal API，但不會暴露 API key
//
// 環境變數：優先使用 FAL_KEY，若未設定則使用 FAL_API_KEY（向後相容）

// 在 import server-proxy 之前，先確保 FAL_KEY 環境變數已設定
// 這是因為 @fal-ai/server-proxy 在模組載入時就會讀取 FAL_KEY
if (!process.env.FAL_KEY && process.env.FAL_API_KEY) {
    process.env.FAL_KEY = process.env.FAL_API_KEY;
}

// 確保環境變數設定正確
if (!process.env.FAL_KEY) {
    console.warn('⚠️  警告：未設定 FAL_KEY 或 FAL_API_KEY 環境變數，Server Proxy 將無法使用');
    console.warn('   前端使用者必須在 localStorage 中設定自己的 API key 才能使用 Fal 服務');
} else {
    console.log('✅ Fal Server Proxy: FAL_KEY 已設定');
}

import { route } from '@fal-ai/server-proxy/nextjs';

export const { GET, POST } = route;
