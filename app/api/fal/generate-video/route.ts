import { NextRequest, NextResponse } from 'next/server';
import { generateVideoKling, generateVideoSeedance } from '@/lib/api/fal';

export async function POST(request: NextRequest) {
    try {
        const {
            imageUrl,
            prompt,
            model,
            duration,
            aspectRatio,
            enableSound,
            enableAudio,
            apiKey,
        } = await request.json();

        if (!imageUrl || !prompt || !model || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        let result;

        if (model === 'kling') {
            result = await generateVideoKling(
                imageUrl,
                prompt,
                {
                    duration: duration as 5 | 10,
                    aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
                    enableSound,
                },
                { apiKey }
            );
        } else if (model === 'seedance') {
            result = await generateVideoSeedance(
                imageUrl,
                prompt,
                {
                    duration,
                    enableAudio,
                },
                { apiKey }
            );
        } else {
            return NextResponse.json(
                { error: 'Invalid model type' },
                { status: 400 }
            );
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Generate video error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
