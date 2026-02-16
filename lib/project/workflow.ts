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
  const scenesWithImages = scenes.filter(scene => Boolean(scene.generatedImage?.url)).length;
  const scenesWithVideos = scenes.filter(scene => Boolean(scene.generatedVideo?.url)).length;
  const totalScenes = scenes.length;
  const allImagesReady = totalScenes > 0 && scenesWithImages === totalScenes;
  const allVideosReady = totalScenes > 0 && scenesWithVideos === totalScenes;

  return {
    hasStoryboard: !!project?.storyboard,
    totalScenes,
    scenesWithImages,
    scenesWithVideos,
    hasImages: allImagesReady,
    hasVideos: allVideosReady,
  };
}
