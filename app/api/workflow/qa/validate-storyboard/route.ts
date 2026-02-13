import { NextRequest, NextResponse } from 'next/server';
import type { Storyboard } from '@/lib/types/storyboard';
import { validateStoryboard } from '@/lib/workflow/storyboard-qa';
import { sqliteQaRepo } from '@/lib/db/sqlite';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { projectId?: string; storyboard?: Storyboard };
    if (!body.projectId || !body.storyboard) {
      return NextResponse.json({ error: 'projectId and storyboard are required' }, { status: 400 });
    }

    const result = validateStoryboard(body.storyboard);
    const report = sqliteQaRepo.create({
      id: crypto.randomUUID(),
      projectId: body.projectId,
      storyboardId: body.storyboard.id,
      score: result.score,
      summary: result.summary,
      issues: result.issues,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ data: report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to validate storyboard' },
      { status: 500 }
    );
  }
}
