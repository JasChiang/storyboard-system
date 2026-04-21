import { NextRequest, NextResponse } from 'next/server';
import { reviewStoryboardCreativity } from '@/lib/api/openrouter';
import type { Scene } from '@/lib/types/storyboard';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
  }

  let body: { scenes?: Scene[] };
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERROR_CODES.INVALID_INPUT, 'Invalid JSON body');
  }

  const { scenes } = body;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return apiError(API_ERROR_CODES.MISSING_FIELD, 'scenes array is required');
  }

  try {
    const review = await reviewStoryboardCreativity(scenes, { apiKey });
    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: '創意評估失敗' });
  }
}
