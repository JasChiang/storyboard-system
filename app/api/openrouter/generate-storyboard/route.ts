import { NextRequest, NextResponse } from 'next/server';
import { generateStoryboardScript } from '@/lib/api/openrouter';
import { TEMPLATES } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return NextResponse.json(
        { error: 'Client-provided apiKey is not allowed' },
        { status: 400 }
      );
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

    // 驗證必要參數
    if (!userPrompt || !apiKey) {
      return NextResponse.json(
        { error: '缺少必要參數（userPrompt）或伺服器未設定 OPENROUTER_API_KEY' },
        { status: 400 }
      );
    }

    // 取得模板
    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];

    // 調用 OpenRouter API（傳遞 references）
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
    return NextResponse.json(
      {
        error: '生成失敗',
        details: error instanceof Error ? error.message : '未知錯誤'
      },
      { status: 500 }
    );
  }
}
