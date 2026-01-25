import { NextRequest, NextResponse } from 'next/server';
import { checkQueueStatus, getImageResult, getVideoResult } from '@/lib/api/fal';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { requestId, endpoint, type } = body;
        // 使用環境變數作為 API Key 的備援（與 generate-image 一致）
        const apiKey = body.apiKey || process.env.FAL_API_KEY;

        if (!requestId || !endpoint || !type || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // 使用 SDK 檢查狀態
        const status = await checkQueueStatus(requestId, endpoint, { apiKey });

        if (status.status === 'COMPLETED') {
            // 直接使用 SDK 取得結果
            const result = type === 'image'
                ? await getImageResult(requestId, endpoint, { apiKey })
                : await getVideoResult(requestId, endpoint, { apiKey });

            return NextResponse.json({
                status: 'COMPLETED',
                result,
            });
        } else if (status.status === 'FAILED') {
            return NextResponse.json({
                status: 'FAILED',
                error: status.error || 'Generation failed',
            });
        } else {
            return NextResponse.json({
                status: status.status, // IN_PROGRESS, IN_QUEUE
                logs: status.logs,
            });
        }
    } catch (error) {
        console.error('Check status error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
