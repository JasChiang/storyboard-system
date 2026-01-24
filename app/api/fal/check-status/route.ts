import { NextRequest, NextResponse } from 'next/server';
import { checkQueueStatus, getImageResult, getVideoResult } from '@/lib/api/fal';

export async function POST(request: NextRequest) {
    try {
        const { requestId, endpoint, type, apiKey } = await request.json();

        if (!requestId || !endpoint || !type || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // 先檢查狀態
        const status = await checkQueueStatus(requestId, endpoint, { apiKey });

        if (status.status === 'COMPLETED') {
            // 獲取完整結果
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
