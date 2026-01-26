// 這個 proxy endpoint 會安全地處理所有 Fal API 請求
// 前端可以直接呼叫 Fal API，但不會暴露 API key
//
// 環境變數：統一使用 FAL_API_KEY

import { NextResponse } from 'next/server';
import { handleRequest, fromHeaders, responsePassthrough } from '@fal-ai/server-proxy';

export const runtime = 'nodejs';

const resolveApiKey = async (): Promise<string | undefined> => {
    if (process.env.FAL_API_KEY) return process.env.FAL_API_KEY;
    if (process.env.FAL_KEY) return process.env.FAL_KEY;
    if (process.env.FAL_KEY_ID && process.env.FAL_KEY_SECRET) {
        return `${process.env.FAL_KEY_ID}:${process.env.FAL_KEY_SECRET}`;
    }
    return undefined;
};

async function routeHandler(request: Request) {
    const apiKey = await resolveApiKey();
    if (!apiKey) {
        console.warn('⚠️  Fal Server Proxy: Missing FAL_API_KEY');
        return NextResponse.json({ error: 'Missing FAL_API_KEY on server' }, { status: 500 });
    }

    const responseHeaders = new Headers();
    return handleRequest({
        id: 'nextjs-app-router',
        method: request.method,
        getRequestBody: async () => request.text(),
        getHeaders: () => fromHeaders(request.headers),
        getHeader: (name) => request.headers.get(name),
        sendHeader: (name, value) => responseHeaders.set(name, value),
        respondWith: (status, data) =>
            NextResponse.json(data, {
                status,
                headers: responseHeaders,
            }),
        sendResponse: responsePassthrough,
        resolveApiKey: async () => apiKey,
    });
}

export const GET = routeHandler;
export const POST = routeHandler;
export const PUT = routeHandler;
