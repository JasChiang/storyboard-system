import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/api/fal';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, referenceImage, aspectRatio, resolution } = body;
        const apiKey = body.apiKey || process.env.FAL_API_KEY;

        if (!prompt || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const result = await generateImage(
            prompt,
            {
                referenceImage,
                aspectRatio,
                resolution,
            },
            { apiKey }
        );

        // 計算使用的 endpoint
        // 重要：status endpoint 永遠使用基礎模型名稱，不包含 /edit
        // 即使生成時使用了 /edit endpoint
        const baseModel = process.env.FAL_IMAGE_MODEL || 'fal-ai/nano-banana-pro';
        const statusEndpoint = baseModel; // 永遠使用基礎模型名稱來檢查狀態

        // 將 endpoint 加入回應，讓前端知道要用哪個 endpoint 輪詢
        return NextResponse.json({
            ...result,
            endpoint: statusEndpoint, // 用於狀態檢查的 endpoint
        });
    } catch (error) {
        console.error('Generate image error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
