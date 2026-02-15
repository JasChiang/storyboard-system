import { NextRequest, NextResponse } from 'next/server';
import { reviewStoryboardCreativity } from '@/lib/api/openrouter';
import type { Scene } from '@/lib/types/storyboard';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
  }

  let body: { scenes?: Scene[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { scenes } = body;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json({ error: 'scenes array is required' }, { status: 400 });
  }

  try {
    const review = await reviewStoryboardCreativity(scenes, { apiKey });
    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    const message = error instanceof Error ? error.message : '創意評估失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
