import { NextRequest, NextResponse } from 'next/server';
import { generateCharacterProfile } from '@/lib/api/openrouter';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return NextResponse.json(
        { error: 'Client-provided apiKey is not allowed' },
        { status: 400 }
      );
    }

    const { name, type, views } = body;
    const apiKey = process.env.OPENROUTER_API_KEY;
    const normalizedViews = Array.isArray(views) ? views : [];

    if (!name || !type) {
      return NextResponse.json(
        { error: '缺少必要欄位（name, type）' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: '伺服器未設定 OPENROUTER_API_KEY' },
        { status: 500 }
      );
    }

    const result = await generateCharacterProfile(
      {
        name,
        type,
        views: normalizedViews,
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
