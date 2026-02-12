import { NextRequest, NextResponse } from 'next/server';
import { generateCharacterProfile } from '@/lib/api/openrouter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, views } = body;
    const apiKey = body.apiKey || process.env.OPENROUTER_API_KEY;

    if (!name || !type || !Array.isArray(views) || views.length === 0) {
      return NextResponse.json(
        { error: '缺少必要欄位（name, type, views）' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: '缺少 OpenRouter API Key' },
        { status: 500 }
      );
    }

    const result = await generateCharacterProfile(
      {
        name,
        type,
        views,
      },
      { apiKey }
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Generate character profile error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '生成失敗',
      },
      { status: 500 }
    );
  }
}
