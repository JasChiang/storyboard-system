import { NextRequest, NextResponse } from 'next/server';
import { sqliteTaskRepo, type GenerationTask } from '@/lib/db/sqlite';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    const tasks = sqliteTaskRepo.listByProject(projectId);
    return NextResponse.json({ data: tasks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GenerationTask>;

    if (!body.projectId || !body.stage || !body.status) {
      return NextResponse.json({ error: 'projectId, stage and status are required' }, { status: 400 });
    }

    const created = sqliteTaskRepo.create({
      id: body.id || crypto.randomUUID(),
      projectId: body.projectId,
      sceneId: body.sceneId,
      stage: body.stage,
      status: body.status,
      model: body.model,
      prompt: body.prompt,
      inputUrl: body.inputUrl,
      outputUrl: body.outputUrl,
      error: body.error,
      attempts: body.attempts,
      metadata: body.metadata,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create task' },
      { status: 500 }
    );
  }
}
