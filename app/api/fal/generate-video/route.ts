import { NextRequest, NextResponse } from 'next/server';
import {
    generateVideoKling,
    generateVideoSeedance,
    type KlingVariant,
    type SeedanceVariant,
} from '@/lib/api/fal';
import { enforceVideoPromptPolicy } from '@/lib/video/prompt-policy';

const KLING_VARIANTS: readonly KlingVariant[] = ['v26', 'o3', 'o1', 'o1_ref'] as const;
const SEEDANCE_VARIANTS: readonly SeedanceVariant[] = ['v15', 'v20', 'v20_ref', 'v20_fast_ref'] as const;

function parseReferenceImageUrls(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const urls = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
    return urls.length > 0 ? urls : undefined;
}

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
            endImageUrl,
            klingVariant,
            seedanceVariant,
            referenceImageUrls,
            resolution,
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
        const resolvedKlingVariant: KlingVariant = KLING_VARIANTS.includes(klingVariant)
            ? (klingVariant as KlingVariant)
            : 'v26';
        const resolvedSeedanceVariant: SeedanceVariant = SEEDANCE_VARIANTS.includes(seedanceVariant)
            ? (seedanceVariant as SeedanceVariant)
            : 'v15';
        const isKlingReferenceMode = model === 'kling' && resolvedKlingVariant === 'o1_ref';
        const isSeedanceReferenceMode = model === 'seedance'
            && (resolvedSeedanceVariant === 'v20_ref' || resolvedSeedanceVariant === 'v20_fast_ref');
        const isReferenceMode = isKlingReferenceMode || isSeedanceReferenceMode;
        const parsedReferenceUrls = parseReferenceImageUrls(referenceImageUrls);

        if (!normalizedPrompt || !model) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }
        if (!isReferenceMode && !normalizedImageUrl) {
            return NextResponse.json(
                { error: 'Missing required start image URL' },
                { status: 400 }
            );
        }
        if (isReferenceMode && !parsedReferenceUrls) {
            return NextResponse.json(
                { error: 'reference-to-video 模式需要至少一張 referenceImageUrls' },
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
            klingVariant: model === 'kling' ? resolvedKlingVariant : undefined,
            seedanceVariant: model === 'seedance' ? resolvedSeedanceVariant : undefined,
            referenceMode: isReferenceMode,
            referenceCount: parsedReferenceUrls?.length || 0,
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
                    endImageUrl: normalizedEndImageUrl,
                    variant: resolvedKlingVariant,
                    referenceImageUrls: parsedReferenceUrls,
                },
                { apiKey }
            );
            endpoint = result.endpoint || '';
        } else if (model === 'seedance') {
            result = await generateVideoSeedance(
                normalizedImageUrl,
                safePrompt,
                {
                    duration,
                    aspectRatio,
                    resolution,
                    enableAudio,
                    endImageUrl: normalizedEndImageUrl,
                    variant: resolvedSeedanceVariant,
                    referenceImageUrls: parsedReferenceUrls,
                },
                { apiKey }
            );
            endpoint = result.endpoint || '';
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
