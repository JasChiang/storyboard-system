import { NextRequest, NextResponse } from 'next/server';
import { generateHookVariants } from '@/lib/api/openrouter';
import type { Scene } from '@/lib/types/storyboard';

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY not configured' }, { status: 500 });
  }

  let body: { topic?: string; references?: string; existingScene1?: Partial<Scene> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { topic, references, existingScene1 } = body;
  if (!topic) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
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
    const message = error instanceof Error ? error.message : 'Hook 變體生成失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
