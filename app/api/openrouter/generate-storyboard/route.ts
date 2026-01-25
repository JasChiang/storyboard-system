import { NextRequest, NextResponse } from 'next/server';
import { generateStoryboardScript } from '@/lib/api/openrouter';
import { TEMPLATES } from '@/lib/prompts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userPrompt, templateId, references } = body;
    const apiKey = body.apiKey || process.env.OPENROUTER_API_KEY;

    // 驗證必要參數
    if (!userPrompt || !apiKey) {
      return NextResponse.json(
        { error: '缺少必要參數 (userPrompt or apiKey)' },
        { status: 400 }
      );
    }

    // 獲取模板
    const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];

    // 調用 OpenRouter API（傳遞 references）
    const result = await generateStoryboardScript(userPrompt, template, { apiKey }, references);

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
