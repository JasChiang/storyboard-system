import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/api/fal';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prompt, referenceImage, aspectRatio, resolution } = body;
        const apiKey = process.env.FAL_API_KEY;

        if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
            return NextResponse.json(
                { error: 'Client-provided apiKey is not allowed' },
                { status: 400 }
            );
        }

        if (!prompt) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Missing FAL_API_KEY on server' },
                { status: 500 }
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
        // 重要：status endpoint 必須與提交請求時使用的 endpoint 完全相同
        // 如果有參考圖，使用 /edit endpoint；否則使用基礎模型
        const baseModel = process.env.FAL_IMAGE_MODEL || 'fal-ai/nano-banana-pro';
        const hasReference = referenceImage &&
            (Array.isArray(referenceImage) ? referenceImage.length > 0 : true);
        const statusEndpoint = hasReference ? `${baseModel}/edit` : baseModel;

        // 將 endpoint 加入回應，讓前端知道要用哪個 endpoint 輪詢
        return NextResponse.json({
            ...result,
            endpoint: statusEndpoint, // 用於狀態檢查的 endpoint（必須與生成時相同）
        });
    } catch (error) {
        console.error('Generate image error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
