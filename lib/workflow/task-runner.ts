import {
  sqliteTaskRepo,
  type GenerationTask,
  type GenerationTaskStage,
} from '@/lib/db/sqlite';

export interface TaskExecutionSuccess {
  status: 'completed';
  outputUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskExecutionFailure {
  status: 'failed';
  error: string;
  metadata?: Record<string, unknown>;
}

export type TaskExecutionResult = TaskExecutionSuccess | TaskExecutionFailure;
export type TaskHandler = (task: GenerationTask) => Promise<TaskExecutionResult>;
export type TaskHandlerMap = Partial<Record<GenerationTaskStage, TaskHandler>>;

export interface RunNextQueuedTaskOptions {
  projectId?: string;
  stage?: GenerationTaskStage;
  staleAfterMinutes?: number;
}

export interface RunNextQueuedTaskResult {
  task: GenerationTask | null;
  result?: TaskExecutionResult;
  reason?: 'no_task' | 'missing_handler';
}

let isRunning = false;

export async function runNextQueuedTask(
  handlers: TaskHandlerMap,
  options: RunNextQueuedTaskOptions = {}
): Promise<RunNextQueuedTaskResult> {
  if (isRunning) {
    return { task: null, reason: 'no_task' };
  }

  isRunning = true;
  try {
    const staleAfterMinutes = Number(options.staleAfterMinutes ?? 0);
    if (Number.isFinite(staleAfterMinutes) && staleAfterMinutes > 0) {
      const staleBeforeIso = new Date(Date.now() - staleAfterMinutes * 60_000).toISOString();
      sqliteTaskRepo.markStaleRunningAsFailed(staleBeforeIso);
    }

    const task = sqliteTaskRepo.claimNextQueued({
      projectId: options.projectId,
      stage: options.stage,
    });
    if (!task) {
      return { task: null, reason: 'no_task' };
    }

    const handler = handlers[task.stage];
    if (!handler) {
      sqliteTaskRepo.update(task.id, {
        status: 'failed',
        error: `No task handler registered for stage: ${task.stage}`,
      });
      return {
        task: sqliteTaskRepo.getById(task.id),
        reason: 'missing_handler',
        result: {
          status: 'failed',
          error: `No task handler registered for stage: ${task.stage}`,
        },
      };
    }

    try {
      const result = await handler(task);
      if (result.status === 'completed') {
        sqliteTaskRepo.update(task.id, {
          status: 'completed',
          outputUrl: result.outputUrl,
          metadata: result.metadata,
        });
      } else {
        sqliteTaskRepo.update(task.id, {
          status: 'failed',
          error: result.error,
          metadata: result.metadata,
        });
      }
      return {
        task: sqliteTaskRepo.getById(task.id),
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Task execution failed';
      sqliteTaskRepo.update(task.id, {
        status: 'failed',
        error: message,
      });
      return {
        task: sqliteTaskRepo.getById(task.id),
        result: {
          status: 'failed',
          error: message,
        },
      };
    }
  } finally {
    isRunning = false;
  }
}
