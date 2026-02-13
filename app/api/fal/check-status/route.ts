import { NextRequest, NextResponse } from 'next/server';
import { checkQueueStatus, getImageResult, getVideoResult } from '@/lib/api/fal';

function extractFalErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    const maybeError = error as { body?: unknown };
    if (maybeError?.body && typeof maybeError.body === 'object') {
        const body = maybeError.body as { detail?: unknown };
        if (Array.isArray(body.detail)) {
            const msgs = body.detail
                .map((item) => {
                    if (!item || typeof item !== 'object') return '';
                    const msg = (item as { msg?: string }).msg;
                    return typeof msg === 'string' ? msg : '';
                })
                .filter(Boolean);
            if (msgs.length) return msgs.join('; ');
        }
    }

    return 'Generation failed';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { requestId, endpoint, type } = body;
        const apiKey = process.env.FAL_API_KEY;

        if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
            return NextResponse.json(
                { error: 'Client-provided apiKey is not allowed' },
                { status: 400 }
            );
        }

        if (!requestId || !endpoint || !type) {
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

        // 使用 SDK 檢查狀態
        const status = await checkQueueStatus(requestId, endpoint, { apiKey });

        if (status.status === 'COMPLETED') {
            // 直接使用 SDK 取得結果
            try {
                const result = type === 'image'
                    ? await getImageResult(requestId, endpoint, { apiKey })
                    : await getVideoResult(requestId, endpoint, { apiKey });

                return NextResponse.json({
                    status: 'COMPLETED',
                    result,
                });
            } catch (resultError) {
                return NextResponse.json({
                    status: 'FAILED',
                    error: extractFalErrorMessage(resultError),
                });
            }
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
            {
                status: 'FAILED',
                error: extractFalErrorMessage(error),
            }
        );
    }
}
