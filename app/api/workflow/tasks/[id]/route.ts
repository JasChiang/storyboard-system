import { NextRequest, NextResponse } from 'next/server';
import { sqliteGenerationRunRepo, sqliteTaskRepo, type GenerationTask } from '@/lib/db/sqlite';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = sqliteTaskRepo.getById(id);
    if (!task) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Task not found');
    }
    return NextResponse.json({ data: task });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to fetch task' });
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
      return apiError(API_ERROR_CODES.NOT_FOUND, 'Task not found');
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
    return apiErrorFromUnknown(error, { message: 'Failed to update task' });
  }
}
