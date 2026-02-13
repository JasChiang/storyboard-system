import type { Project } from '@/lib/types/project';

export interface WorkflowProgress {
  hasStoryboard: boolean;
  totalScenes: number;
  scenesWithImages: number;
  scenesWithVideos: number;
  hasImages: boolean;
  hasVideos: boolean;
}

export function getWorkflowProgress(project?: Project | null): WorkflowProgress {
  const scenes = project?.storyboard?.scenes || [];
  const scenesWithImages = scenes.filter(scene => scene.generatedImage).length;
  const scenesWithVideos = scenes.filter(scene => scene.generatedVideo).length;

  return {
    hasStoryboard: !!project?.storyboard,
    totalScenes: scenes.length,
    scenesWithImages,
    scenesWithVideos,
    hasImages: scenesWithImages > 0,
    hasVideos: scenesWithVideos > 0,
  };
}

