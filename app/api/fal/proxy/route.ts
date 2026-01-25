import { route } from '@fal-ai/server-proxy/nextjs';

// 這個 proxy endpoint 會安全地處理所有 Fal API 請求
// 前端可以直接呼叫 Fal API，但不會暴露 API key
//
// 環境變數：優先使用 FAL_KEY，若未設定則使用 FAL_API_KEY（向後相容）
// 注意：@fal-ai/server-proxy 內部會自動讀取 FAL_KEY 環境變數

// 確保環境變數設定正確
if (!process.env.FAL_KEY && !process.env.FAL_API_KEY) {
    console.warn('⚠️  警告：未設定 FAL_KEY 或 FAL_API_KEY 環境變數，Server Proxy 將無法使用');
    console.warn('   前端使用者必須在 localStorage 中設定自己的 API key 才能使用 Fal 服務');
}

// 如果只有 FAL_API_KEY，將它設定為 FAL_KEY（讓 server-proxy 能讀取）
if (!process.env.FAL_KEY && process.env.FAL_API_KEY) {
    process.env.FAL_KEY = process.env.FAL_API_KEY;
    console.log('✅ Fal Server Proxy: 使用 FAL_API_KEY（已轉換為 FAL_KEY）');
} else if (process.env.FAL_KEY) {
    console.log('✅ Fal Server Proxy: 使用 FAL_KEY');
}

export const { GET, POST } = route;
