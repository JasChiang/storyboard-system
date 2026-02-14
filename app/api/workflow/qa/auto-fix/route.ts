import { NextRequest, NextResponse } from 'next/server';
import type { Storyboard } from '@/lib/types/storyboard';
import { sqliteProjectRepo } from '@/lib/db/sqlite';
import { autoFixStoryboardBlockingIssues } from '@/lib/workflow/qa-autofix';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      projectId?: string;
      storyboard?: Storyboard;
      maxScenes?: number;
      model?: string;
    };

    if (!body.projectId || !body.storyboard) {
      return NextResponse.json({ error: 'projectId and storyboard are required' }, { status: 400 });
    }

    const result = await autoFixStoryboardBlockingIssues({
      projectId: body.projectId,
      storyboard: body.storyboard,
      options: {
        maxScenes: typeof body.maxScenes === 'number' ? body.maxScenes : undefined,
        model: typeof body.model === 'string' ? body.model : undefined,
      },
    });

    const updatedProject = sqliteProjectRepo.update(body.projectId, {
      storyboard: result.storyboard,
      status: 'storyboard',
    });
    if (!updatedProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-fix storyboard' },
      { status: 500 }
    );
  }
}
