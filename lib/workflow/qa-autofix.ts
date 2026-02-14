import { regenerateStoryboardScene } from '@/lib/api/openrouter';
import { sqliteQaRepo, type StoryboardQaIssue } from '@/lib/db/sqlite';
import { TEMPLATES } from '@/lib/prompts';
import type { Scene, Storyboard } from '@/lib/types/storyboard';
import { validateStoryboard } from '@/lib/workflow/storyboard-qa';

interface AutoFixOptions {
  maxScenes?: number;
  model?: string;
}

interface AutoFixQaReport {
  id: string;
  projectId: string;
  storyboardId: string;
  score: number;
  summary: string;
  issues: StoryboardQaIssue[];
  createdAt: string;
  sceneReports: Array<{
    sceneId?: string;
    sceneNumber?: number;
    status: 'pass' | 'warn' | 'block';
    issues: StoryboardQaIssue[];
  }>;
}

export interface AutoFixResult {
  storyboard: Storyboard;
  qaReport: AutoFixQaReport;
  fixedSceneIds: string[];
  skippedSceneIds: string[];
  blockedBefore: number;
  blockedAfter: number;
}

function applyQaStatusToScenes(scenes: Scene[], issues: StoryboardQaIssue[]): Scene[] {
  return scenes.map((scene) => {
    const sceneIssues = issues.filter((issue) => issue.sceneId === scene.id || issue.sceneNumber === scene.sceneNumber);
    const hasHigh = sceneIssues.some((issue) => issue.severity === 'high');
    const hasMedium = sceneIssues.some((issue) => issue.severity === 'medium');
    return {
      ...scene,
      qaStatus: hasHigh ? 'block' : hasMedium ? 'warn' : 'pass',
      qaIssues: sceneIssues.map((issue) => issue.message),
    };
  });
}

function mergeRegeneratedScene(base: Scene, regenerated: Partial<Scene>): Scene {
  const merged: Scene = {
    ...base,
    ...regenerated,
    id: base.id,
    sceneNumber: base.sceneNumber,
    description: (regenerated.description || base.description || '').trim(),
    cameraMovement: (regenerated.cameraMovement || base.cameraMovement || 'Static shot').trim(),
    dialogue: regenerated.dialogue ?? base.dialogue ?? '',
    duration:
      typeof regenerated.duration === 'number' && regenerated.duration > 0
        ? regenerated.duration
        : base.duration > 0
          ? base.duration
          : 5,
    transitionToNext: {
      ...base.transitionToNext,
      ...regenerated.transitionToNext,
      type: regenerated.transitionToNext?.type || base.transitionToNext?.type || 'dissolve',
    },
    generatedImage: undefined,
    generatedEndFrame: undefined,
    generatedVideo: undefined,
    motionPrompt: undefined,
    videoPromptDraft: undefined,
    videoPromptDraftNotes: undefined,
  };

  if (merged.requiresEndFrame === false) {
    merged.endFrameDescription = undefined;
    merged.endFrameDelta = undefined;
    merged.endFrameDeltaSpec = undefined;
    merged.generatedEndFrame = undefined;
  }

  return merged;
}

function buildSceneContext(scenes: Scene[]) {
  return scenes.map((scene) => ({
    sceneNumber: scene.sceneNumber,
    description: scene.description,
    cameraMovement: scene.cameraMovement,
    dialogue: scene.dialogue,
    duration: scene.duration,
  }));
}

export async function autoFixStoryboardBlockingIssues(args: {
  projectId: string;
  storyboard: Storyboard;
  options?: AutoFixOptions;
}): Promise<AutoFixResult> {
  const { projectId, storyboard, options } = args;
  const initialQa = validateStoryboard(storyboard);
  const blockedSceneNumberSet = new Set<number>();
  const sceneNumberById = new Map(storyboard.scenes.map((scene) => [scene.id, scene.sceneNumber]));

  initialQa.issues.forEach((issue) => {
    if (issue.severity !== 'high') return;
    if (typeof issue.sceneNumber === 'number') {
      blockedSceneNumberSet.add(issue.sceneNumber);
      return;
    }
    if (issue.sceneId) {
      const sceneNumber = sceneNumberById.get(issue.sceneId);
      if (typeof sceneNumber === 'number') {
        blockedSceneNumberSet.add(sceneNumber);
      }
    }
  });

  const blockedSceneNumbers = Array.from(blockedSceneNumberSet).sort((a, b) => a - b);
  const requestedMaxScenes = options?.maxScenes ?? blockedSceneNumbers.length;
  const maxScenes = Math.max(1, Math.min(10, requestedMaxScenes || 1));
  const targetSceneNumbers = blockedSceneNumbers.slice(0, maxScenes);
  const skippedSceneIds: string[] = [];
  const fixedSceneIds: string[] = [];

  const workingScenes = storyboard.scenes.map((scene) => ({ ...scene }));

  if (targetSceneNumbers.length > 0) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY on server');
    }

    const template = TEMPLATES.find((item) => item.id === storyboard.templateUsed) || TEMPLATES[0];

    for (const sceneNumber of targetSceneNumbers) {
      const sceneIndex = workingScenes.findIndex((scene) => scene.sceneNumber === sceneNumber);
      if (sceneIndex < 0) {
        continue;
      }

      const targetScene = workingScenes[sceneIndex];
      if (!targetScene) {
        continue;
      }

      try {
        const regenerated = await regenerateStoryboardScene(
          storyboard.originalPrompt,
          template,
          targetScene,
          buildSceneContext(workingScenes),
          {
            apiKey,
            model: options?.model,
          },
          storyboard.projectReferences || []
        );
        workingScenes[sceneIndex] = mergeRegeneratedScene(targetScene, regenerated);
        fixedSceneIds.push(targetScene.id);
      } catch {
        skippedSceneIds.push(targetScene.id);
      }
    }
  }

  const finalQa = validateStoryboard({
    ...storyboard,
    scenes: workingScenes,
  });
  const finalScenes = applyQaStatusToScenes(workingScenes, finalQa.issues);
  const updatedStoryboard: Storyboard = {
    ...storyboard,
    scenes: finalScenes,
    updatedAt: new Date().toISOString(),
  };

  const reportRecord = sqliteQaRepo.create({
    id: crypto.randomUUID(),
    projectId,
    storyboardId: updatedStoryboard.id,
    score: finalQa.score,
    summary: finalQa.summary,
    issues: finalQa.issues,
    createdAt: new Date().toISOString(),
  });

  const finalSceneNumberById = new Map(updatedStoryboard.scenes.map((scene) => [scene.id, scene.sceneNumber]));
  const blockedAfterSet = new Set<number>();
  finalQa.issues.forEach((issue) => {
    if (issue.severity !== 'high') return;
    if (typeof issue.sceneNumber === 'number') {
      blockedAfterSet.add(issue.sceneNumber);
      return;
    }
    if (issue.sceneId) {
      const sceneNumber = finalSceneNumberById.get(issue.sceneId);
      if (typeof sceneNumber === 'number') {
        blockedAfterSet.add(sceneNumber);
      }
    }
  });

  return {
    storyboard: updatedStoryboard,
    qaReport: {
      ...reportRecord,
      sceneReports: finalQa.sceneReports,
    },
    fixedSceneIds,
    skippedSceneIds,
    blockedBefore: blockedSceneNumbers.length,
    blockedAfter: blockedAfterSet.size,
  };
}
