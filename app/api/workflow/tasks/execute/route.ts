import { NextRequest, NextResponse } from 'next/server';
import { checkQueueStatus, getImageResult, getVideoResult } from '@/lib/api/fal';
import { sqliteTaskRepo } from '@/lib/db/sqlite';

export const runtime = 'nodejs';

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      taskId?: string;
      timeoutMs?: number;
    };

    const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : '';
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    const task = sqliteTaskRepo.getById(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (task.status !== 'running') {
      return NextResponse.json({ error: 'Task must be in running state before execution' }, { status: 400 });
    }

    const apiKey = process.env.FAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing FAL_API_KEY on server' }, { status: 500 });
    }

    const requestId = typeof task.metadata?.requestId === 'string' ? task.metadata.requestId : '';
    const endpoint = typeof task.metadata?.endpoint === 'string' ? task.metadata.endpoint : '';
    if (!requestId || !endpoint) {
      return NextResponse.json({ error: 'Task metadata missing requestId/endpoint' }, { status: 400 });
    }

    const timeoutMs = Math.max(5_000, Math.min(20 * 60_000, Number(body.timeoutMs || 8 * 60_000)));
    const started = Date.now();
    let attempts = 0;

    while (Date.now() - started < timeoutMs) {
      const status = await checkQueueStatus(requestId, endpoint, { apiKey });
      if (status.status === 'FAILED') {
        const updated = sqliteTaskRepo.update(task.id, {
          status: 'failed',
          error: status.error || 'Generation failed',
          attempts: task.attempts + attempts + 1,
        });
        return NextResponse.json({ data: updated, providerStatus: status });
      }

      if (status.status === 'COMPLETED') {
        if (task.stage === 'video') {
          const result = await getVideoResult(requestId, endpoint, { apiKey });
          const outputUrl = result.video?.url;
          const updated = sqliteTaskRepo.update(task.id, {
            status: outputUrl ? 'completed' : 'failed',
            outputUrl,
            error: outputUrl ? undefined : 'Generation completed but no video URL returned',
            metadata: {
              ...(task.metadata || {}),
              providerMetrics: status.metrics,
              completedAt: new Date().toISOString(),
            },
          });
          return NextResponse.json({ data: updated, providerStatus: status });
        }

        const result = await getImageResult(requestId, endpoint, { apiKey });
        const outputUrl = result.images?.[0]?.url;
        const updated = sqliteTaskRepo.update(task.id, {
          status: outputUrl ? 'completed' : 'failed',
          outputUrl,
          error: outputUrl ? undefined : 'Generation completed but no image URL returned',
          metadata: {
            ...(task.metadata || {}),
            seed: result.seed,
            providerMetrics: status.metrics,
            completedAt: new Date().toISOString(),
          },
        });
        return NextResponse.json({ data: updated, providerStatus: status });
      }

      attempts += 1;
      await wait(Math.min(15_000, 2_500 + attempts * 500));
    }

    return NextResponse.json({ error: 'Task execution timeout' }, { status: 504 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute task' },
      { status: 500 }
    );
  }
}
