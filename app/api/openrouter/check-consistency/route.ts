import { NextRequest, NextResponse } from 'next/server';
import { callVisionMulti } from '@/lib/api/openrouter';
import {
    buildConsistencyPrompt,
    parseConsistencyResponse,
    type ConsistencyCheckEntity,
    type ConsistencyCheckRequest,
} from '@/lib/workflow/consistency-validator';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const maxDuration = 60;

function sanitizeEntities(value: unknown): ConsistencyCheckEntity[] {
    if (!Array.isArray(value)) return [];
    const out: ConsistencyCheckEntity[] = [];
    for (const item of value) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;
        const tag = typeof record.tag === 'string' ? record.tag.trim() : '';
        const entityType = record.entityType === 'product' ? 'product' : 'character';
        const referenceImageUrls = Array.isArray(record.referenceImageUrls)
            ? record.referenceImageUrls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
            : [];
        if (!tag || referenceImageUrls.length === 0) continue;
        out.push({
            tag,
            entityType,
            referenceImageUrls,
            referenceAngle: typeof record.referenceAngle === 'string'
                ? (record.referenceAngle as ConsistencyCheckEntity['referenceAngle'])
                : undefined,
            identityCore: typeof record.identityCore === 'string' ? record.identityCore : undefined,
            mustKeepFeatures: Array.isArray(record.mustKeepFeatures)
                ? record.mustKeepFeatures.filter((s): s is string => typeof s === 'string')
                : undefined,
        });
    }
    return out;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
        }

        const frameImageUrl = typeof body.frameImageUrl === 'string' ? body.frameImageUrl.trim() : '';
        const frameType = body.frameType === 'end' ? 'end' : 'start';
        const sceneId = typeof body.sceneId === 'string' ? body.sceneId : '';
        const sceneNumber = Number.isFinite(Number(body.sceneNumber)) ? Number(body.sceneNumber) : 0;
        const entities = sanitizeEntities(body.entities);

        if (!frameImageUrl) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, '缺少 frameImageUrl');
        }
        if (entities.length === 0) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, '缺少可比對的 entities（至少一個含參考圖的角色或商品）');
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
        }

        const checkRequest: ConsistencyCheckRequest = {
            sceneId,
            sceneNumber,
            frameType,
            frameImageUrl,
            entities,
        };

        const prompt = buildConsistencyPrompt(checkRequest);
        const imageUrls = [frameImageUrl, ...entities.flatMap((entity) => entity.referenceImageUrls)];

        const { content, model } = await callVisionMulti(imageUrls, prompt, { apiKey });
        const report = parseConsistencyResponse(content, checkRequest, model);

        return NextResponse.json({ report });
    } catch (error) {
        console.error('check-consistency error:', error);
        return apiErrorFromUnknown(error, { message: '一致性檢驗失敗' });
    }
}
