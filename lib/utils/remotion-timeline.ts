import type { Scene, TransitionType } from '@/lib/types/storyboard';
import type { TimelineRow, TimelineAction } from '@xzdarcy/timeline-engine';

export interface TimelineActionWithData extends TimelineAction {
  data?: {
    sceneId?: string;
    sceneNumber?: number;
    src?: string;
    subtitle?: string;
    transitionType?: TransitionType;
  };
}

export interface RemotionTimelineData {
  rows: TimelineRow[];
  duration: number;
}

const DEFAULT_TRANSITION_DURATION = 0.5;

function clampDuration(value: number, min = 0.1) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, value);
}

export function scenesToTimelineRows(scenes: Scene[]): RemotionTimelineData {
  let currentTime = 0;
  const videoActions: TimelineActionWithData[] = [];
  const transitionActions: TimelineActionWithData[] = [];
  const subtitleActions: TimelineActionWithData[] = [];

  scenes.forEach((scene, index) => {
    if (index > 0) {
      const prev = scenes[index - 1];
      const overlap = clampDuration(prev.transitionToNext?.duration ?? 0, 0);
      currentTime = Math.max(0, currentTime - overlap);
    }

    const start = currentTime;
    const duration = clampDuration(scene.duration, 0.5);
    const end = start + duration;

    videoActions.push({
      id: `scene-${scene.id}`,
      start,
      end,
      effectId: 'video',
      data: {
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        src: scene.generatedVideo?.url || scene.generatedImage?.url,
        subtitle: scene.dialogue || scene.description,
      },
    });

    if (scene.dialogue || scene.description) {
      subtitleActions.push({
        id: `subtitle-${scene.id}`,
        start,
        end,
        effectId: 'subtitle',
        data: {
          sceneId: scene.id,
          subtitle: scene.dialogue || scene.description,
        },
        movable: false,
      });
    }

    if (scene.transitionToNext && index < scenes.length - 1) {
      const transitionDuration = clampDuration(
        scene.transitionToNext.duration ?? DEFAULT_TRANSITION_DURATION,
        0.1
      );
      const transitionStart = Math.max(start, end - transitionDuration);

      transitionActions.push({
        id: `transition-${scene.id}`,
        start: transitionStart,
        end,
        effectId: 'transition',
        data: {
          sceneId: scene.id,
          transitionType: scene.transitionToNext.type,
        },
        movable: false,
      });
    }

    currentTime = end;
  });

  return {
    rows: [
      { id: 'video-track', actions: videoActions, rowHeight: 64 },
      { id: 'transition-track', actions: transitionActions, rowHeight: 42 },
      { id: 'subtitle-track', actions: subtitleActions, rowHeight: 42 },
    ],
    duration: currentTime,
  };
}

export function timelineRowsToScenes(
  rows: TimelineRow[],
  originalScenes: Scene[]
): Scene[] {
  const videoRow = rows.find(row => row.id === 'video-track');
  if (!videoRow) return originalScenes;

  const sortedVideoActions = [...videoRow.actions]
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const transitionRow = rows.find(row => row.id === 'transition-track');
  const transitionMap = new Map<string, TimelineActionWithData>();

  transitionRow?.actions.forEach(action => {
    const actionWithData = action as TimelineActionWithData;
    const sceneId = actionWithData.data?.sceneId;
    if (sceneId) transitionMap.set(sceneId, actionWithData);
  });

  return sortedVideoActions.map((action, index) => {
    const actionWithData = action as TimelineActionWithData;
    const sceneId = actionWithData.data?.sceneId || action.id.replace('scene-', '');
    const originalScene =
      originalScenes.find(scene => scene.id === sceneId) || originalScenes[index];
    const duration = clampDuration(action.end - action.start, 0.5);

    const transitionAction = transitionMap.get(sceneId);
    const transitionDuration = transitionAction
      ? clampDuration(transitionAction.end - transitionAction.start, 0.1)
      : undefined;
    const transitionType = transitionAction?.data?.transitionType;

    return {
      ...originalScene,
      sceneNumber: index + 1,
      duration,
      transitionToNext: transitionAction
        ? {
            type: transitionType || originalScene.transitionToNext?.type || 'dissolve',
            duration: transitionDuration,
          }
        : undefined,
    };
  });
}

export function updateSceneTransition(
  scenes: Scene[],
  sceneId: string,
  transition: { type: TransitionType; duration: number } | undefined
): Scene[] {
  return scenes.map(scene => {
    if (scene.id !== sceneId) return scene;
    return {
      ...scene,
      transitionToNext: transition,
    };
  });
}

export function updateSceneDuration(
  scenes: Scene[],
  sceneId: string,
  duration: number
): Scene[] {
  return scenes.map(scene => {
    if (scene.id !== sceneId) return scene;
    return {
      ...scene,
      duration: clampDuration(duration, 0.5),
    };
  });
}
