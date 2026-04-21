import { NextRequest, NextResponse } from 'next/server';
import { generateCharacterProfile } from '@/lib/api/openrouter';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
    }

    const { name, type, views } = body;
    const apiKey = process.env.OPENROUTER_API_KEY;
    const normalizedViews = Array.isArray(views) ? views : [];

    if (!name || !type) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, '缺少必要欄位（name, type）');
    }
    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
    }

    const result = await generateCharacterProfile(
      { name, type, views: normalizedViews },
      { apiKey }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Generate character profile error:', error);
    return apiErrorFromUnknown(error, { message: '生成失敗' });
  }
}
