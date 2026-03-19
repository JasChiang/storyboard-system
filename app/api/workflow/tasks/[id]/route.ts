import { NextRequest, NextResponse } from 'next/server';
import { sqliteGenerationRunRepo, sqliteTaskRepo, type GenerationTask } from '@/lib/db/sqlite';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = sqliteTaskRepo.getById(id);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    return NextResponse.json({ data: task });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<GenerationTask>;
    const updated = sqliteTaskRepo.update(id, body);

    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const existingRun = sqliteGenerationRunRepo.listByProject(updated.projectId, 200)
      .find((run) => run.taskId === updated.id);
    if (existingRun) {
      const completedAt = updated.status === 'completed' || updated.status === 'failed'
        ? new Date().toISOString()
        : existingRun.completedAt;
      sqliteGenerationRunRepo.update(existingRun.id, {
        status: updated.status === 'failed' ? 'failed' : updated.status === 'completed' ? 'completed' : 'running',
        outputUrl: updated.outputUrl,
        error: updated.error,
        metadata: {
          ...(existingRun.metadata || {}),
          ...(updated.metadata || {}),
        },
        completedAt,
        durationMs: completedAt ? Math.max(0, Date.parse(completedAt) - Date.parse(existingRun.startedAt)) : existingRun.durationMs,
      });
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update task' },
      { status: 500 }
    );
  }
}
