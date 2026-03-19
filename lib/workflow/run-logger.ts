import { createHash } from 'node:crypto';
import { sqliteGenerationRunRepo, type GenerationRun } from '@/lib/db/sqlite';

export function hashPrompt(prompt?: string): string | undefined {
  const normalized = typeof prompt === 'string' ? prompt.trim() : '';
  if (!normalized) return undefined;
  return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

export function startGenerationRun(input: {
  projectId: string;
  sceneId?: string;
  taskId?: string;
  stage: GenerationRun['stage'];
  provider?: string;
  model?: string;
  inputUrl?: string;
  promptText?: string;
  metadata?: Record<string, unknown>;
}): GenerationRun {
  const now = new Date().toISOString();
  return sqliteGenerationRunRepo.create({
    id: crypto.randomUUID(),
    projectId: input.projectId,
    sceneId: input.sceneId,
    taskId: input.taskId,
    stage: input.stage,
    provider: input.provider,
    model: input.model,
    status: 'running',
    inputUrl: input.inputUrl,
    promptText: input.promptText,
    promptHash: hashPrompt(input.promptText),
    metadata: input.metadata,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });
}

export function completeGenerationRun(
  runId: string,
  updates: {
    status: 'completed' | 'failed';
    outputUrl?: string;
    error?: string;
    metadata?: Record<string, unknown>;
  }
): GenerationRun | null {
  const existing = sqliteGenerationRunRepo.getById(runId);
  if (!existing) return null;
  const completedAt = new Date().toISOString();
  const durationMs = Math.max(0, Date.parse(completedAt) - Date.parse(existing.startedAt));
  return sqliteGenerationRunRepo.update(runId, {
    status: updates.status,
    outputUrl: updates.outputUrl,
    error: updates.error,
    metadata: {
      ...(existing.metadata || {}),
      ...(updates.metadata || {}),
    },
    completedAt,
    durationMs,
  });
}
