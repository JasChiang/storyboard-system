/**
 * 將場景數據轉換為時間軸編輯器格式
 */

import type { Scene } from '@/lib/types/storyboard';

export interface TimelineAction {
  id: string;
  start: number;
  end: number;
  effectId: string;
  data?: {
    src?: string;
    poster?: string;
    subtitle?: string;
    sceneNumber?: number;
  };
}

export interface TimelineRow {
  id: string;
  actions: TimelineAction[];
}

export interface TimelineData {
  rows: TimelineRow[];
  duration: number;
}

/**
 * 將場景數組轉換為時間軸數據
 */
export function scenesToTimeline(scenes: Scene[]): TimelineData {
  let currentTime = 0;
  const videoActions: TimelineAction[] = [];
  const subtitleActions: TimelineAction[] = [];

  scenes.forEach((scene, index) => {
    const start = currentTime;
    const end = currentTime + scene.duration;

    // 視頻/圖片軌道
    videoActions.push({
      id: `scene-${scene.id}`,
      start,
      end,
      effectId: scene.generatedVideo ? 'video' : 'image',
      data: {
        src: scene.generatedVideo?.url || scene.generatedImage?.url,
        poster: scene.generatedImage?.url,
        sceneNumber: scene.sceneNumber,
        subtitle: scene.subtitles || scene.description,
      },
    });

    // 字幕軌道
    if (scene.subtitles || scene.description) {
      subtitleActions.push({
        id: `subtitle-${scene.id}`,
        start,
        end,
        effectId: 'subtitle',
        data: {
          subtitle: scene.subtitles || scene.description,
        },
      });
    }

    currentTime = end;
  });

  return {
    rows: [
      {
        id: 'video-track',
        actions: videoActions,
      },
      {
        id: 'subtitle-track',
        actions: subtitleActions,
      },
    ],
    duration: currentTime,
  };
}

/**
 * 將時間軸數據轉換回場景數組
 */
export function timelineToScenes(
  timelineData: TimelineData,
  originalScenes: Scene[]
): Scene[] {
  const videoRow = timelineData.rows.find(row => row.id === 'video-track');
  if (!videoRow) return originalScenes;

  return videoRow.actions.map((action, index) => {
    // 找到對應的原始場景
    const sceneId = action.id.replace('scene-', '');
    const originalScene = originalScenes.find(s => s.id === sceneId) || originalScenes[index];

    return {
      ...originalScene,
      duration: action.end - action.start,
      subtitles: action.data?.subtitle,
    };
  });
}
