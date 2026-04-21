import { NextRequest, NextResponse } from 'next/server';
import { sqliteTaskRepo, sqliteGenerationRunRepo, type GenerationTask, type GenerationTaskStage, type GenerationTaskStatus } from '@/lib/db/sqlite';
import { checkQueueStatus, getImageResult, getVideoResult } from '@/lib/api/fal';
import { hashPrompt } from '@/lib/workflow/run-logger';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export const runtime = 'nodejs';
const MISSING_RECOVERY_METADATA_TIMEOUT_MS = 45_000;
const RECOVERY_STAGE_SET = new Set<GenerationTaskStage>(['image_start', 'image_end', 'video']);

function parseCsvParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function getRecoveryMeta(task: GenerationTask): { requestId: string; endpoint: string } | null {
  const metadata = task.metadata || {};
  const requestId = typeof metadata.requestId === 'string' ? metadata.requestId.trim() : '';
  const endpoint = typeof metadata.endpoint === 'string' ? metadata.endpoint.trim() : '';
  if (!requestId || !endpoint) return null;
  return { requestId, endpoint };
}

async function recoverRunningTasks(projectId: string): Promise<{
  recovered: number;
  failed: number;
}> {
  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) return { recovered: 0, failed: 0 };

  const runningTasks = sqliteTaskRepo.listByProject(projectId, {
    status: 'running',
  });

  let recovered = 0;
  let failed = 0;

  for (const task of runningTasks) {
    if (!RECOVERY_STAGE_SET.has(task.stage)) continue;

    const meta = getRecoveryMeta(task);
    if (!meta) {
      const updatedAt = Date.parse(task.updatedAt);
      if (!Number.isFinite(updatedAt) || Date.now() - updatedAt <= MISSING_RECOVERY_METADATA_TIMEOUT_MS) {
        continue;
      }
      const updated = sqliteTaskRepo.update(task.id, {
        status: 'failed',
        error: 'Task recovery metadata missing (requestId/endpoint). Please regenerate.',
      });
      if (updated) failed += 1;
      continue;
    }

    try {
      const queueStatus = await checkQueueStatus(meta.requestId, meta.endpoint, { apiKey });
      if (queueStatus.status === 'FAILED') {
        const updated = sqliteTaskRepo.update(task.id, {
          status: 'failed',
          error: queueStatus.error || 'Generation failed during recovery',
          attempts: task.attempts + 1,
        });
        if (updated) failed += 1;
        continue;
      }

      if (queueStatus.status !== 'COMPLETED') {
        continue;
      }

      if (task.stage === 'image_start' || task.stage === 'image_end') {
        const result = await getImageResult(meta.requestId, meta.endpoint, { apiKey });
        const imageUrl = typeof result.images?.[0]?.url === 'string' ? result.images[0].url.trim() : '';
        if (!imageUrl) {
          const updated = sqliteTaskRepo.update(task.id, {
            status: 'failed',
            error: 'Generation completed but no image URL returned',
            attempts: task.attempts + 1,
          });
          if (updated) failed += 1;
          continue;
        }

        const seed = typeof result.seed === 'number' ? result.seed : undefined;
        const updated = sqliteTaskRepo.update(task.id, {
          status: 'completed',
          outputUrl: imageUrl,
          metadata: {
            ...(task.metadata || {}),
            requestId: meta.requestId,
            endpoint: meta.endpoint,
            seed,
            recoveredAt: new Date().toISOString(),
          },
        });
        if (updated) recovered += 1;
        continue;
      }

      const result = await getVideoResult(meta.requestId, meta.endpoint, { apiKey });
      const videoUrl = typeof result.video?.url === 'string' ? result.video.url.trim() : '';
      if (!videoUrl) {
        const updated = sqliteTaskRepo.update(task.id, {
          status: 'failed',
          error: 'Generation completed but no video URL returned',
          attempts: task.attempts + 1,
        });
        if (updated) failed += 1;
        continue;
      }

      const updated = sqliteTaskRepo.update(task.id, {
        status: 'completed',
        outputUrl: videoUrl,
        metadata: {
          ...(task.metadata || {}),
          requestId: meta.requestId,
          endpoint: meta.endpoint,
          recoveredAt: new Date().toISOString(),
        },
      });
      if (updated) recovered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Task recovery failed';
      const updated = sqliteTaskRepo.update(task.id, {
        status: 'failed',
        error: message,
        attempts: task.attempts + 1,
      });
      if (updated) failed += 1;
    }
  }

  return { recovered, failed };
}

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'projectId is required');
    }

    const statuses = parseCsvParam(req.nextUrl.searchParams.get('status')) as GenerationTaskStatus[];
    const stages = parseCsvParam(req.nextUrl.searchParams.get('stage')) as GenerationTaskStage[];
    const recoverRunning = req.nextUrl.searchParams.get('recoverRunning') === '1';

    let recoverySummary: { recovered: number; failed: number } | null = null;
    if (recoverRunning) {
      recoverySummary = await recoverRunningTasks(projectId);
    }

    const tasks = sqliteTaskRepo.listByProject(projectId, {
      status: statuses.length > 0 ? statuses : undefined,
      stage: stages.length > 0 ? stages : undefined,
    });
    return NextResponse.json({
      data: tasks,
      recovery: recoverySummary,
    });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to fetch tasks' });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<GenerationTask>;

    if (!body.projectId || !body.stage) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'projectId and stage are required');
    }

    const created = sqliteTaskRepo.create({
      id: body.id || crypto.randomUUID(),
      projectId: body.projectId,
      sceneId: body.sceneId,
      stage: body.stage,
      status: body.status || 'queued',
      model: body.model,
      prompt: body.prompt,
      inputUrl: body.inputUrl,
      outputUrl: body.outputUrl,
      error: body.error,
      attempts: body.attempts,
      metadata: body.metadata,
    });

    if (created.status === 'running') {
      const now = new Date().toISOString();
      sqliteGenerationRunRepo.create({
        id: crypto.randomUUID(),
        projectId: created.projectId,
        sceneId: created.sceneId,
        taskId: created.id,
        stage: created.stage,
        provider: created.stage === 'video' || created.stage.startsWith('image_') ? 'fal' : 'workflow',
        model: created.model,
        status: 'running',
        inputUrl: created.inputUrl,
        promptText: created.prompt,
        promptHash: hashPrompt(created.prompt),
        metadata: created.metadata,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Failed to create task' });
  }
}
