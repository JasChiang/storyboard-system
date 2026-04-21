import { NextRequest, NextResponse } from 'next/server';
import { generateHookVariants } from '@/lib/api/openrouter';
import type { Scene } from '@/lib/types/storyboard';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
  }

  let body: { topic?: string; references?: string; existingScene1?: Partial<Scene> };
  try {
    body = await request.json();
  } catch {
    return apiError(API_ERROR_CODES.INVALID_INPUT, 'Invalid JSON body');
  }

  const { topic, references, existingScene1 } = body;
  if (!topic) {
    return apiError(API_ERROR_CODES.MISSING_FIELD, 'topic is required');
  }

  try {
    const variants = await generateHookVariants(
      topic,
      references || '',
      existingScene1 || {},
      { apiKey }
    );
    return NextResponse.json({ success: true, data: { variants } });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Hook 變體生成失敗' });
  }
}
