import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/api/fal';
import {
    IMAGE_GENERATION_MODEL_ENDPOINTS,
    resolveImageModelEndpoint,
    isGptImage2Endpoint,
    type GptImage2Quality,
    type ImageGenerationModel,
} from '@/lib/constants/image-models';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

const GPT_IMAGE_2_QUALITIES: readonly GptImage2Quality[] = ['low', 'medium', 'high'];

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            prompt,
            referenceImage,
            aspectRatio,
            resolution,
            model,
            seed,
            quality,
            maskImageUrl,
        } = body;
        const apiKey = process.env.FAL_API_KEY;

        if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
        }

        if (!prompt) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing required field: prompt');
        }
        if (!apiKey) {
            return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, 'Missing FAL_API_KEY on server');
        }
        if (typeof seed !== 'undefined' && (typeof seed !== 'number' || !Number.isFinite(seed))) {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Invalid seed value');
        }

        const normalizedModel = typeof model === 'string' ? model.trim() as ImageGenerationModel : undefined;
        if (normalizedModel && !(normalizedModel in IMAGE_GENERATION_MODEL_ENDPOINTS)) {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Invalid image model type');
        }

        const baseModel = normalizedModel
            ? IMAGE_GENERATION_MODEL_ENDPOINTS[normalizedModel]
            : process.env.FAL_IMAGE_MODEL || 'openai/gpt-image-2';
        const hasReference = referenceImage &&
            (Array.isArray(referenceImage) ? referenceImage.length > 0 : true);
        const { endpoint: resolvedEndpoint, isEditOnlyEndpoint } = resolveImageModelEndpoint(baseModel, Boolean(hasReference));

        if (isEditOnlyEndpoint && !hasReference) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, 'Selected image model requires at least one reference image');
        }

        const isGpt2 = isGptImage2Endpoint(resolvedEndpoint);
        let normalizedQuality: GptImage2Quality | undefined;
        if (typeof quality !== 'undefined') {
            if (!isGpt2) {
                return apiError(API_ERROR_CODES.INVALID_INPUT, 'quality is only supported for gpt-image-2');
            }
            if (typeof quality !== 'string' || !GPT_IMAGE_2_QUALITIES.includes(quality as GptImage2Quality)) {
                return apiError(API_ERROR_CODES.INVALID_INPUT, 'Invalid quality; expected low|medium|high');
            }
            normalizedQuality = quality as GptImage2Quality;
        }

        let normalizedMaskUrl: string | undefined;
        if (typeof maskImageUrl !== 'undefined') {
            if (!isGpt2) {
                return apiError(API_ERROR_CODES.INVALID_INPUT, 'maskImageUrl is only supported for gpt-image-2');
            }
            if (!hasReference) {
                return apiError(API_ERROR_CODES.INVALID_INPUT, 'maskImageUrl requires at least one reference image');
            }
            if (typeof maskImageUrl !== 'string' || !/^https?:\/\//i.test(maskImageUrl)) {
                return apiError(API_ERROR_CODES.INVALID_INPUT, 'maskImageUrl must be an http(s) URL');
            }
            normalizedMaskUrl = maskImageUrl;
        }

        const result = await generateImage(
            prompt,
            {
                referenceImage,
                aspectRatio,
                resolution,
                modelEndpoint: resolvedEndpoint,
                seed: typeof seed === 'number' && Number.isFinite(seed) ? Math.trunc(seed) : undefined,
                quality: normalizedQuality,
                maskImageUrl: normalizedMaskUrl,
            },
            { apiKey }
        );

        // 計算使用的 endpoint
        // 重要：status endpoint 必須與提交請求時使用的 endpoint 完全相同
        // 如果有參考圖，使用 /edit endpoint；否則使用基礎模型
        const statusEndpoint = resolvedEndpoint;

        // 將 endpoint 加入回應，讓前端知道要用哪個 endpoint 輪詢
        return NextResponse.json({
            ...result,
            endpoint: statusEndpoint, // 用於狀態檢查的 endpoint（必須與生成時相同）
            model: normalizedModel || null,
        });
    } catch (error) {
        console.error('Generate image error:', error);
        return apiErrorFromUnknown(error, { message: 'Generate image failed' });
    }
}
