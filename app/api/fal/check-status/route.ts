import { NextRequest, NextResponse } from 'next/server';
import { checkQueueStatus, getAudioResult, getImageResult, getVideoResult } from '@/lib/api/fal';

function extractFalErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        const message = error.message;
        const maybeError = error as { body?: unknown };
        if (maybeError?.body && typeof maybeError.body === 'object') {
            const body = maybeError.body as { detail?: unknown; error?: unknown; message?: unknown };
            if (typeof body.error === 'string' && body.error.trim()) {
                return `${message}: ${body.error.trim()}`;
            }
            if (typeof body.message === 'string' && body.message.trim()) {
                return `${message}: ${body.message.trim()}`;
            }
        }
        return message;
    }

    const maybeError = error as { body?: unknown };
    if (maybeError?.body && typeof maybeError.body === 'object') {
        const body = maybeError.body as { detail?: unknown };
        if (Array.isArray(body.detail)) {
            const msgs = body.detail
                .map((item) => {
                    if (!item || typeof item !== 'object') return '';
                    const entry = item as { msg?: string; loc?: unknown };
                    const msg = typeof entry.msg === 'string' ? entry.msg : '';
                    const loc = Array.isArray(entry.loc)
                        ? entry.loc.map((v) => String(v)).join('.')
                        : '';
                    if (msg && loc) return `${loc}: ${msg}`;
                    return msg;
                })
                .filter(Boolean);
            if (msgs.length) return msgs.join('; ');
        }
    }

    return 'Generation failed';
}

function deriveEndpointFromResponseUrl(responseUrl?: string): string | null {
    if (!responseUrl) return null;
    try {
        const url = new URL(responseUrl);
        // Example: /fal-ai/kling-video/requests/{id}
        const path = url.pathname.replace(/^\/+/, '');
        const marker = '/requests/';
        const idx = path.indexOf(marker);
        if (idx <= 0) return null;
        const endpoint = path.slice(0, idx).trim();
        return endpoint || null;
    } catch {
        return null;
    }
}

async function fetchResultByResponseUrl(
    responseUrl: string,
    apiKey: string
): Promise<unknown> {
    const headersList: Array<HeadersInit | undefined> = [
        undefined,
        { Authorization: `Key ${apiKey}` },
        { Authorization: `Bearer ${apiKey}` },
    ];

    for (const headers of headersList) {
        const res = await fetch(responseUrl, { headers, cache: 'no-store' });
        if (!res.ok) {
            continue;
        }
        return res.json();
    }

    throw new Error('Failed to fetch result via response_url');
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
                    : type === 'audio'
                        ? await getAudioResult(requestId, endpoint, { apiKey })
                        : await getVideoResult(requestId, endpoint, { apiKey });

                return NextResponse.json({
                    status: 'COMPLETED',
                    result,
                });
            } catch (resultError) {
                console.error('[check-status] Primary result fetch failed:', {
                    requestId,
                    endpoint,
                    responseUrl: status.response_url,
                    error: extractFalErrorMessage(resultError),
                });

                // Fallback: 某些 Fal 任務在 status 可用原 endpoint，
                // 但 result 需要使用 response_url 中的 normalized endpoint。
                const fallbackEndpoint = deriveEndpointFromResponseUrl(status.response_url);
                if (fallbackEndpoint && fallbackEndpoint !== endpoint) {
                    try {
                        const fallbackResult = type === 'image'
                            ? await getImageResult(requestId, fallbackEndpoint, { apiKey })
                            : type === 'audio'
                                ? await getAudioResult(requestId, fallbackEndpoint, { apiKey })
                                : await getVideoResult(requestId, fallbackEndpoint, { apiKey });

                        return NextResponse.json({
                            status: 'COMPLETED',
                            result: fallbackResult,
                        });
                    } catch (fallbackError) {
                        console.error('[check-status] Fallback endpoint result fetch failed:', {
                            requestId,
                            fallbackEndpoint,
                            responseUrl: status.response_url,
                            error: extractFalErrorMessage(fallbackError),
                        });
                    }
                }

                // Final fallback: 直接使用 Fal 的 response_url 取結果
                if (status.response_url) {
                    try {
                        const raw = await fetchResultByResponseUrl(status.response_url, apiKey);
                        const payload = raw as {
                            data?: unknown;
                            video?: unknown;
                            images?: unknown;
                            audio?: unknown;
                            audios?: unknown;
                            url?: unknown;
                        };
                        const result = payload.data ?? (payload.video || payload.images || payload.audio || payload.audios || payload.url ? payload : null);
                        if (result) {
                            return NextResponse.json({
                                status: 'COMPLETED',
                                result,
                            });
                        }
                    } catch (responseUrlError) {
                        console.error('[check-status] response_url fetch failed:', {
                            requestId,
                            responseUrl: status.response_url,
                            error: extractFalErrorMessage(responseUrlError),
                        });
                    }
                }

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
