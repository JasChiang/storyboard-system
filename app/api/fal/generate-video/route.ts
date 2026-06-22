import { NextRequest, NextResponse } from 'next/server';
import {
    generateVideoKling,
    generateVideoSeedance,
    SEEDANCE_REF_VARIANTS,
    SEEDANCE_T2V_VARIANTS,
    type KlingVariant,
    type SeedanceVariant,
} from '@/lib/api/fal';
import { enforceVideoPromptPolicy } from '@/lib/video/prompt-policy';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

const KLING_VARIANTS: readonly KlingVariant[] = ['v26', 'o3', 'o1', 'o1_ref'] as const;
const SEEDANCE_VARIANTS: readonly SeedanceVariant[] = [
    'v20_i2v',
    'v20_i2v_fast',
    'v20_ref',
    'v20_ref_fast',
    'v20_t2v',
    'v20_t2v_fast',
] as const;

function parseRefList(value: unknown, max: number): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const urls = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, max);
    return urls.length > 0 ? urls : undefined;
}

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
            referenceVideoUrls,
            referenceAudioUrls,
            resolution,
        } = body;
        const apiKey = process.env.FAL_API_KEY;

        if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
        }

        const normalizedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';
        const normalizedPrompt = typeof prompt === 'string' ? prompt.trim() : '';
        const resolvedKlingVariant: KlingVariant = KLING_VARIANTS.includes(klingVariant)
            ? (klingVariant as KlingVariant)
            : 'v26';
        const resolvedSeedanceVariant: SeedanceVariant = SEEDANCE_VARIANTS.includes(seedanceVariant)
            ? (seedanceVariant as SeedanceVariant)
            : 'v20_i2v';
        const isKlingReferenceMode = model === 'kling' && resolvedKlingVariant === 'o1_ref';
        const isSeedanceReferenceMode = model === 'seedance'
            && SEEDANCE_REF_VARIANTS.includes(resolvedSeedanceVariant);
        const isSeedanceTextMode = model === 'seedance'
            && SEEDANCE_T2V_VARIANTS.includes(resolvedSeedanceVariant);
        const isReferenceMode = isKlingReferenceMode || isSeedanceReferenceMode;
        const parsedReferenceUrls = parseReferenceImageUrls(referenceImageUrls);
        const parsedReferenceVideoUrls = parseRefList(referenceVideoUrls, 3);
        const parsedReferenceAudioUrls = parseRefList(referenceAudioUrls, 3);

        if (!normalizedPrompt || !model) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing required fields: prompt, model');
        }
        if (!isReferenceMode && !isSeedanceTextMode && !normalizedImageUrl) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing required start image URL');
        }
        if (isSeedanceReferenceMode && !parsedReferenceUrls && !parsedReferenceVideoUrls && !parsedReferenceAudioUrls) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, 'reference-to-video 模式需要至少一個 reference 資源（image/video/audio）');
        }
        if (isKlingReferenceMode && !parsedReferenceUrls) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, 'Kling reference-to-video 模式需要至少一張 referenceImageUrls');
        }
        if (!apiKey) {
            return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, 'Missing FAL_API_KEY on server');
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
                isSeedanceTextMode ? null : normalizedImageUrl,
                safePrompt,
                {
                    duration,
                    aspectRatio,
                    resolution,
                    enableAudio,
                    endImageUrl: normalizedEndImageUrl,
                    variant: resolvedSeedanceVariant,
                    referenceImageUrls: parsedReferenceUrls,
                    referenceVideoUrls: parsedReferenceVideoUrls,
                    referenceAudioUrls: parsedReferenceAudioUrls,
                },
                { apiKey }
            );
            endpoint = result.endpoint || '';
        } else {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Invalid model type');
        }

        return NextResponse.json({ ...result, endpoint, promptPolicy });
    } catch (error) {
        console.error('Generate video error:', error);
        return apiErrorFromUnknown(error, { message: 'Generate video failed' });
    }
}
