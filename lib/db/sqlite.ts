import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { Project } from '@/lib/types/project';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import { normalizeCharacterItem } from '@/lib/characters/workflow';

const DB_DIR = path.join(process.cwd(), '.data');
const DB_PATH = path.join(DB_DIR, 'storyboard.sqlite');

let db: Database.Database | null = null;

type DbRow = Record<string, unknown>;

function ensureDb() {
  if (db) return db;

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      target_duration_sec INTEGER,
      storyboard_json TEXT,
      blender_script TEXT,
      editing_suggestions_json TEXT,
      openreel_project_json TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      scene_id TEXT,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      model TEXT,
      prompt TEXT,
      input_url TEXT,
      output_url TEXT,
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS storyboard_qa_reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      storyboard_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      summary TEXT NOT NULL,
      issues_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS character_library_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      usage_count INTEGER NOT NULL DEFAULT 0,
      item_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS translation_cache (
      text_hash TEXT PRIMARY KEY,
      source_text TEXT NOT NULL,
      translated_text TEXT NOT NULL,
      field_kind TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      scene_id TEXT,
      task_id TEXT,
      stage TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      status TEXT NOT NULL,
      input_url TEXT,
      output_url TEXT,
      prompt_text TEXT,
      prompt_hash TEXT,
      metadata_json TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      duration_ms INTEGER,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_generation_tasks_project_stage
      ON generation_tasks(project_id, stage, status);

    CREATE INDEX IF NOT EXISTS idx_generation_runs_project_stage
      ON generation_runs(project_id, stage, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_qa_reports_project
      ON storyboard_qa_reports(project_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_character_library_name_type
      ON character_library_items(name, type, updated_at DESC);
  `);

  const projectColumns = (db.prepare('PRAGMA table_info(projects)').all() as Array<{ name: string }>)
    .map((column) => column.name);
  if (!projectColumns.includes('target_duration_sec')) {
    db.exec('ALTER TABLE projects ADD COLUMN target_duration_sec INTEGER');
  }

  const characterColumns = (db.prepare('PRAGMA table_info(character_library_items)').all() as Array<{ name: string }>)
    .map((column) => column.name);
  if (!characterColumns.includes('version')) {
    db.exec('ALTER TABLE character_library_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1');
  }

  return db;
}

function rowToProject(row: DbRow): Project {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    targetDurationSec: row.target_duration_sec !== null
      && row.target_duration_sec !== undefined
      && Number.isFinite(Number(row.target_duration_sec))
      ? Number(row.target_duration_sec)
      : undefined,
    storyboard: row.storyboard_json ? JSON.parse(String(row.storyboard_json)) : undefined,
    blenderScript: row.blender_script ? String(row.blender_script) : undefined,
    editingSuggestions: row.editing_suggestions_json ? JSON.parse(String(row.editing_suggestions_json)) : undefined,
    openreelProjectJson: row.openreel_project_json ? String(row.openreel_project_json) : undefined,
    status: String(row.status) as Project['status'],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const sqliteProjectRepo = {
  getAll(): Project[] {
    const conn = ensureDb();
    const rows = conn.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as DbRow[];
    return rows.map(rowToProject);
  },

  getById(id: string): Project | null {
    const conn = ensureDb();
    const row = conn.prepare('SELECT * FROM projects WHERE id = ?').get(id) as DbRow | undefined;
    return row ? rowToProject(row) : null;
  },

  create(project: Project): Project {
    const conn = ensureDb();
    conn.prepare(`
      INSERT INTO projects (
        id, name, description, target_duration_sec, storyboard_json, blender_script,
        editing_suggestions_json, openreel_project_json, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      project.id,
      project.name,
      project.description ?? null,
      Number.isFinite(Number(project.targetDurationSec)) ? Number(project.targetDurationSec) : null,
      project.storyboard ? JSON.stringify(project.storyboard) : null,
      project.blenderScript ?? null,
      project.editingSuggestions ? JSON.stringify(project.editingSuggestions) : null,
      project.openreelProjectJson ?? null,
      project.status,
      project.createdAt,
      project.updatedAt
    );
    return project;
  },

  update(id: string, updates: Partial<Project>): Project | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const merged: Project = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    const conn = ensureDb();
    conn.prepare(`
      UPDATE projects
      SET name = ?,
          description = ?,
          target_duration_sec = ?,
          storyboard_json = ?,
          blender_script = ?,
          editing_suggestions_json = ?,
          openreel_project_json = ?,
          status = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.description ?? null,
      Number.isFinite(Number(merged.targetDurationSec)) ? Number(merged.targetDurationSec) : null,
      merged.storyboard ? JSON.stringify(merged.storyboard) : null,
      merged.blenderScript ?? null,
      merged.editingSuggestions ? JSON.stringify(merged.editingSuggestions) : null,
      merged.openreelProjectJson ?? null,
      merged.status,
      merged.updatedAt,
      id
    );

    return merged;
  },

  delete(id: string): boolean {
    const conn = ensureDb();
    const result = conn.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  },
};

export type GenerationTaskStage = 'image_start' | 'image_end' | 'video' | 'qa_autofix';
export type GenerationTaskStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface GenerationTask {
  id: string;
  projectId: string;
  sceneId?: string;
  stage: GenerationTaskStage;
  status: GenerationTaskStatus;
  model?: string;
  prompt?: string;
  inputUrl?: string;
  outputUrl?: string;
  error?: string;
  attempts: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function rowToTask(row: DbRow): GenerationTask {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sceneId: row.scene_id ? String(row.scene_id) : undefined,
    stage: String(row.stage) as GenerationTaskStage,
    status: String(row.status) as GenerationTaskStatus,
    model: row.model ? String(row.model) : undefined,
    prompt: row.prompt ? String(row.prompt) : undefined,
    inputUrl: row.input_url ? String(row.input_url) : undefined,
    outputUrl: row.output_url ? String(row.output_url) : undefined,
    error: row.error ? String(row.error) : undefined,
    attempts: Number(row.attempts || 0),
    metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const sqliteTaskRepo = {
  create(task: Omit<GenerationTask, 'createdAt' | 'updatedAt' | 'attempts'> & { attempts?: number }): GenerationTask {
    const now = new Date().toISOString();
    const payload: GenerationTask = {
      ...task,
      attempts: task.attempts ?? 0,
      createdAt: now,
      updatedAt: now,
    };

    const conn = ensureDb();
    conn.prepare(`
      INSERT INTO generation_tasks (
        id, project_id, scene_id, stage, status, model, prompt,
        input_url, output_url, error, attempts, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      payload.id,
      payload.projectId,
      payload.sceneId ?? null,
      payload.stage,
      payload.status,
      payload.model ?? null,
      payload.prompt ?? null,
      payload.inputUrl ?? null,
      payload.outputUrl ?? null,
      payload.error ?? null,
      payload.attempts,
      payload.metadata ? JSON.stringify(payload.metadata) : null,
      payload.createdAt,
      payload.updatedAt
    );

    return payload;
  },

  getById(id: string): GenerationTask | null {
    const conn = ensureDb();
    const row = conn.prepare('SELECT * FROM generation_tasks WHERE id = ?').get(id) as DbRow | undefined;
    return row ? rowToTask(row) : null;
  },

  update(id: string, updates: Partial<GenerationTask>): GenerationTask | null {
    const conn = ensureDb();
    const row = conn.prepare('SELECT * FROM generation_tasks WHERE id = ?').get(id) as DbRow | undefined;
    if (!row) return null;

    const current = rowToTask(row);
    const merged: GenerationTask = {
      ...current,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
      attempts: typeof updates.attempts === 'number' ? updates.attempts : current.attempts,
    };

    conn.prepare(`
      UPDATE generation_tasks
      SET project_id = ?, scene_id = ?, stage = ?, status = ?, model = ?, prompt = ?,
          input_url = ?, output_url = ?, error = ?, attempts = ?, metadata_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.projectId,
      merged.sceneId ?? null,
      merged.stage,
      merged.status,
      merged.model ?? null,
      merged.prompt ?? null,
      merged.inputUrl ?? null,
      merged.outputUrl ?? null,
      merged.error ?? null,
      merged.attempts,
      merged.metadata ? JSON.stringify(merged.metadata) : null,
      merged.updatedAt,
      id
    );

    return merged;
  },

  listByProject(
    projectId: string,
    options?: {
      status?: GenerationTaskStatus | GenerationTaskStatus[];
      stage?: GenerationTaskStage | GenerationTaskStage[];
    }
  ): GenerationTask[] {
    const conn = ensureDb();
    const clauses = ['project_id = ?'];
    const params: unknown[] = [projectId];

    const statuses = options?.status
      ? (Array.isArray(options.status) ? options.status : [options.status]).filter(Boolean)
      : [];
    if (statuses.length > 0) {
      clauses.push(`status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }

    const stages = options?.stage
      ? (Array.isArray(options.stage) ? options.stage : [options.stage]).filter(Boolean)
      : [];
    if (stages.length > 0) {
      clauses.push(`stage IN (${stages.map(() => '?').join(', ')})`);
      params.push(...stages);
    }

    const rows = conn
      .prepare(`SELECT * FROM generation_tasks WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`)
      .all(...params) as DbRow[];
    return rows.map(rowToTask);
  },

  claimNextQueued(options?: { projectId?: string; stage?: GenerationTaskStage }): GenerationTask | null {
    const conn = ensureDb();
    const clauses = ['status = ?'];
    const params: unknown[] = ['queued'];

    if (options?.projectId) {
      clauses.push('project_id = ?');
      params.push(options.projectId);
    }
    if (options?.stage) {
      clauses.push('stage = ?');
      params.push(options.stage);
    }

    const claimTx = conn.transaction((): GenerationTask | null => {
      const row = conn
        .prepare(`SELECT id FROM generation_tasks WHERE ${clauses.join(' AND ')} ORDER BY created_at ASC LIMIT 1`)
        .get(...params) as DbRow | undefined;
      if (!row?.id) return null;

      const taskId = String(row.id);
      const now = new Date().toISOString();
      const updateResult = conn
        .prepare(`
          UPDATE generation_tasks
          SET status = 'running',
              attempts = attempts + 1,
              error = NULL,
              updated_at = ?
          WHERE id = ? AND status = 'queued'
        `)
        .run(now, taskId);
      if (updateResult.changes === 0) {
        return null;
      }

      const claimedRow = conn.prepare('SELECT * FROM generation_tasks WHERE id = ?').get(taskId) as DbRow | undefined;
      return claimedRow ? rowToTask(claimedRow) : null;
    });

    return claimTx();
  },

  markStaleRunningAsFailed(staleBeforeIso: string, reason = 'Task marked failed due to stale running state'): number {
    const conn = ensureDb();
    const now = new Date().toISOString();
    const result = conn
      .prepare(`
        UPDATE generation_tasks
        SET status = 'failed',
            error = ?,
            updated_at = ?
        WHERE status = 'running' AND updated_at < ?
      `)
      .run(reason, now, staleBeforeIso);
    return result.changes;
  },
};

export interface GenerationRun {
  id: string;
  projectId: string;
  sceneId?: string;
  taskId?: string;
  stage: GenerationTaskStage | 'ffmpeg_render' | 'openreel_export' | 'blender_export';
  provider?: string;
  model?: string;
  status: 'running' | 'completed' | 'failed';
  inputUrl?: string;
  outputUrl?: string;
  promptText?: string;
  promptHash?: string;
  metadata?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

function rowToGenerationRun(row: DbRow): GenerationRun {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sceneId: row.scene_id ? String(row.scene_id) : undefined,
    taskId: row.task_id ? String(row.task_id) : undefined,
    stage: String(row.stage) as GenerationRun['stage'],
    provider: row.provider ? String(row.provider) : undefined,
    model: row.model ? String(row.model) : undefined,
    status: String(row.status) as GenerationRun['status'],
    inputUrl: row.input_url ? String(row.input_url) : undefined,
    outputUrl: row.output_url ? String(row.output_url) : undefined,
    promptText: row.prompt_text ? String(row.prompt_text) : undefined,
    promptHash: row.prompt_hash ? String(row.prompt_hash) : undefined,
    metadata: row.metadata_json ? JSON.parse(String(row.metadata_json)) : undefined,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    durationMs: row.duration_ms !== null && row.duration_ms !== undefined ? Number(row.duration_ms) : undefined,
    error: row.error ? String(row.error) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const sqliteGenerationRunRepo = {
  create(run: GenerationRun): GenerationRun {
    const conn = ensureDb();
    conn.prepare(`
      INSERT INTO generation_runs (
        id, project_id, scene_id, task_id, stage, provider, model, status,
        input_url, output_url, prompt_text, prompt_hash, metadata_json,
        started_at, completed_at, duration_ms, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id,
      run.projectId,
      run.sceneId ?? null,
      run.taskId ?? null,
      run.stage,
      run.provider ?? null,
      run.model ?? null,
      run.status,
      run.inputUrl ?? null,
      run.outputUrl ?? null,
      run.promptText ?? null,
      run.promptHash ?? null,
      run.metadata ? JSON.stringify(run.metadata) : null,
      run.startedAt,
      run.completedAt ?? null,
      run.durationMs ?? null,
      run.error ?? null,
      run.createdAt,
      run.updatedAt
    );
    return run;
  },

  getById(id: string): GenerationRun | null {
    const conn = ensureDb();
    const row = conn.prepare('SELECT * FROM generation_runs WHERE id = ?').get(id) as DbRow | undefined;
    return row ? rowToGenerationRun(row) : null;
  },

  update(id: string, updates: Partial<GenerationRun>): GenerationRun | null {
    const current = this.getById(id);
    if (!current) return null;
    const merged: GenerationRun = {
      ...current,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };
    const conn = ensureDb();
    conn.prepare(`
      UPDATE generation_runs
      SET project_id = ?, scene_id = ?, task_id = ?, stage = ?, provider = ?, model = ?, status = ?,
          input_url = ?, output_url = ?, prompt_text = ?, prompt_hash = ?, metadata_json = ?,
          started_at = ?, completed_at = ?, duration_ms = ?, error = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.projectId,
      merged.sceneId ?? null,
      merged.taskId ?? null,
      merged.stage,
      merged.provider ?? null,
      merged.model ?? null,
      merged.status,
      merged.inputUrl ?? null,
      merged.outputUrl ?? null,
      merged.promptText ?? null,
      merged.promptHash ?? null,
      merged.metadata ? JSON.stringify(merged.metadata) : null,
      merged.startedAt,
      merged.completedAt ?? null,
      merged.durationMs ?? null,
      merged.error ?? null,
      merged.updatedAt,
      id
    );
    return merged;
  },

  listByProject(projectId: string, limit = 100): GenerationRun[] {
    const conn = ensureDb();
    const rows = conn.prepare('SELECT * FROM generation_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?').all(projectId, limit) as DbRow[];
    return rows.map(rowToGenerationRun);
  },
};

export interface StoryboardQaIssue {
  sceneId?: string;
  sceneNumber?: number;
  severity: 'high' | 'medium' | 'low';
  code: string;
  message: string;
}

export interface StoryboardQaReport {
  id: string;
  projectId: string;
  storyboardId: string;
  score: number;
  summary: string;
  issues: StoryboardQaIssue[];
  createdAt: string;
}

function rowToQaReport(row: DbRow): StoryboardQaReport {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    storyboardId: String(row.storyboard_id),
    score: Number(row.score || 0),
    summary: String(row.summary),
    issues: JSON.parse(String(row.issues_json)),
    createdAt: String(row.created_at),
  };
}

export const sqliteQaRepo = {
  create(report: StoryboardQaReport): StoryboardQaReport {
    const conn = ensureDb();
    conn.prepare(`
      INSERT INTO storyboard_qa_reports (
        id, project_id, storyboard_id, score, summary, issues_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      report.id,
      report.projectId,
      report.storyboardId,
      report.score,
      report.summary,
      JSON.stringify(report.issues),
      report.createdAt
    );
    return report;
  },

  getLatestByProject(projectId: string): StoryboardQaReport | null {
    const conn = ensureDb();
    const row = conn
      .prepare('SELECT * FROM storyboard_qa_reports WHERE project_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(projectId) as DbRow | undefined;
    return row ? rowToQaReport(row) : null;
  },
};

export const sqliteTranslationCacheRepo = {
  get(textHash: string): string | null {
    const conn = ensureDb();
    const row = conn
      .prepare('SELECT translated_text FROM translation_cache WHERE text_hash = ?')
      .get(textHash) as { translated_text?: string } | undefined;
    return row?.translated_text ?? null;
  },

  set(textHash: string, sourceText: string, translatedText: string, fieldKind?: string): void {
    const conn = ensureDb();
    conn.prepare(`
      INSERT INTO translation_cache (text_hash, source_text, translated_text, field_kind, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(text_hash) DO UPDATE SET
        translated_text = excluded.translated_text,
        field_kind = excluded.field_kind
    `).run(
      textHash,
      sourceText,
      translatedText,
      fieldKind || null,
      new Date().toISOString()
    );
  },
};

function rowToCharacterItem(row: DbRow): CharacterLibraryItem {
  const parsed = JSON.parse(String(row.item_json)) as CharacterLibraryItem;
  return normalizeCharacterItem({
    ...parsed,
    id: String(row.id),
    name: String(row.name),
    type: String(row.type) as CharacterLibraryItem['type'],
    version: Number(row.version || 1),
    usageCount: Number(row.usage_count || 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  });
}

export const sqliteCharacterLibraryRepo = {
  getAll(): CharacterLibraryItem[] {
    const conn = ensureDb();
    const rows = conn
      .prepare('SELECT * FROM character_library_items ORDER BY updated_at DESC')
      .all() as DbRow[];
    return rows.map(rowToCharacterItem);
  },

  getById(id: string): CharacterLibraryItem | null {
    const conn = ensureDb();
    const row = conn
      .prepare('SELECT * FROM character_library_items WHERE id = ?')
      .get(id) as DbRow | undefined;
    return row ? rowToCharacterItem(row) : null;
  },

  create(item: CharacterLibraryItem): CharacterLibraryItem {
    const conn = ensureDb();
    conn.prepare(`
      INSERT INTO character_library_items (
        id, name, type, version, usage_count, item_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id,
      item.name,
      item.type,
      item.version,
      item.usageCount,
      JSON.stringify(item),
      item.createdAt,
      item.updatedAt
    );
    return item;
  },

  update(id: string, updates: Partial<CharacterLibraryItem>): CharacterLibraryItem | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const merged: CharacterLibraryItem = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt,
      usageCount: typeof updates.usageCount === 'number' ? updates.usageCount : existing.usageCount,
      version: typeof updates.version === 'number'
        ? updates.version
        : (Object.keys(updates).filter((key) => key !== 'usageCount').length > 0 ? existing.version + 1 : existing.version),
      currentSnapshotId: typeof updates.currentSnapshotId === 'string'
        ? updates.currentSnapshotId
        : (Object.keys(updates).filter((key) => key !== 'usageCount').length > 0 ? `snapshot-${crypto.randomUUID()}` : existing.currentSnapshotId),
    };

    const conn = ensureDb();
    conn.prepare(`
      UPDATE character_library_items
      SET name = ?, type = ?, version = ?, usage_count = ?, item_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.name,
      merged.type,
      merged.version,
      merged.usageCount,
      JSON.stringify(merged),
      merged.updatedAt,
      id
    );

    return merged;
  },

  delete(id: string): boolean {
    const conn = ensureDb();
    const result = conn.prepare('DELETE FROM character_library_items WHERE id = ?').run(id);
    return result.changes > 0;
  },

  incrementUsage(id: string): CharacterLibraryItem | null {
    const existing = this.getById(id);
    if (!existing) return null;
    return this.update(id, { usageCount: existing.usageCount + 1 });
  },
};
