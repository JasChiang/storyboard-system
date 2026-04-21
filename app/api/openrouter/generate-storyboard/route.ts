import { NextRequest, NextResponse } from 'next/server';
import { generateStoryboardScript } from '@/lib/api/openrouter';
import { TEMPLATES } from '@/lib/prompts';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
    }

    const { userPrompt, templateId, references } = body;
    const rawTargetDuration = Number(body.targetDurationSec);
    const allowedDurations = new Set([15, 20, 25, 30, 60]);
    const targetDurationSec = allowedDurations.has(rawTargetDuration) ? rawTargetDuration : undefined;
    const rawTargetSceneCount = Number(body?.targetSceneCount);
    const targetSceneCount = Number.isFinite(rawTargetSceneCount) && rawTargetSceneCount > 6
      ? Math.min(20, Math.floor(rawTargetSceneCount))
      : undefined;
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!userPrompt) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, '缺少必要參數 userPrompt');
    }
    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
    }

    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];

    const result = await generateStoryboardScript(
      userPrompt,
      template,
      { apiKey },
      references,
      { targetDurationSec, targetSceneCount }
    );

    return NextResponse.json({
      success: true,
      data: result,
      templateUsed: template.id,
    });
  } catch (error) {
    console.error('分鏡腳本生成錯誤:', error);
    return apiErrorFromUnknown(error, { message: '生成失敗' });
  }
}
