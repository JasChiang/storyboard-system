import { NextRequest, NextResponse } from 'next/server';
import { checkQueueStatus } from '@/lib/api/fal';

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
            // 當狀態為 COMPLETED 時，需要使用 response_url 獲取實際結果
            if (!status.response_url) {
                throw new Error('Status is COMPLETED but no response_url provided');
            }

            // 使用 response_url 獲取完整結果
            const resultResponse = await fetch(status.response_url, {
                headers: {
                    'Authorization': `Key ${apiKey}`,
                }
            });

            if (!resultResponse.ok) {
                const errorText = await resultResponse.text();
                console.error('Failed to fetch result:', resultResponse.status, errorText);
                throw new Error(`Failed to fetch result: ${errorText}`);
            }

            const result = await resultResponse.json();
            console.log('Result data:', JSON.stringify(result, null, 2));

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
