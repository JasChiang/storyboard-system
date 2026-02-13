import { NextRequest, NextResponse } from 'next/server';
import { generateVideoKling, generateVideoSeedance } from '@/lib/api/fal';
import { enforceVideoPromptPolicy } from '@/lib/video/prompt-policy';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            imageUrl,
            prompt,
            model,
            duration,
            aspectRatio,
            enableSound,
            enableAudio,
            endImageUrl,  // 尾幀圖片 URL
            klingVariant,
        } = body;
        const apiKey = process.env.FAL_API_KEY;

        if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
            return NextResponse.json(
                { error: 'Client-provided apiKey is not allowed' },
                { status: 400 }
            );
        }

        const normalizedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
        const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';

        if (!normalizedImageUrl || !normalizedPrompt || !model) {
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

        const promptPolicy = enforceVideoPromptPolicy(prompt, model);
        const safePrompt = promptPolicy.prompt;
        const normalizedEndImageUrl = typeof endImageUrl === 'string' ? endImageUrl.trim() : undefined;

        console.log('[generate-video] request summary:', {
            model,
            klingVariant: model === 'kling' ? klingVariant : undefined,
            hasStartImage: Boolean(normalizedImageUrl),
            hasEndImage: Boolean(normalizedEndImageUrl),
            duration,
            aspectRatio,
            enableSound,
            enableAudio,
            promptLength: safePrompt.length,
        });

        let result;
        let endpoint = '';

        if (model === 'kling') {
            result = await generateVideoKling(
                normalizedImageUrl,
                safePrompt,
                {
                    duration: duration as 5 | 10,
                    aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
                    enableSound,
                    endImageUrl: normalizedEndImageUrl,  // 傳遞尾幀圖片 URL
                    variant: klingVariant === 'o3' ? 'o3' : 'v26',
                },
                { apiKey }
            );
            endpoint = result.endpoint || '';
        } else if (model === 'seedance') {
            const { aspectRatio, resolution } = body;
            result = await generateVideoSeedance(
                normalizedImageUrl,
                safePrompt,
                {
                    duration,
                    aspectRatio,
                    resolution,
                    enableAudio,
                    endImageUrl: normalizedEndImageUrl,  // 傳遞尾幀圖片 URL
                },
                { apiKey }
            );
            endpoint = process.env.FAL_VIDEO_SEEDANCE_MODEL || 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video';
        } else {
            return NextResponse.json(
                { error: 'Invalid model type' },
                { status: 400 }
            );
        }

        return NextResponse.json({ ...result, endpoint, promptPolicy });
    } catch (error) {
        console.error('Generate video error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
