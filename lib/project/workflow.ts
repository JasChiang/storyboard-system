import type { Project } from '@/lib/types/project';
import type { Scene } from '@/lib/types/storyboard';

export interface WorkflowProgress {
  hasStoryboard: boolean;
  totalScenes: number;
  scenesWithImages: number;
  scenesWithVideos: number;
  scenesSkippingImage: number; // videoMode='reference' 或 'text' — 這些場景不需要首幀
  hasImages: boolean;
  hasVideos: boolean;
}

// Seedance ref / t2v 場景不走圖片 stage — 不該計入 hasImages 的分母。
export function sceneSkipsImageStage(scene: Pick<Scene, 'videoMode'>): boolean {
  return scene.videoMode === 'reference' || scene.videoMode === 'text';
}

export function getWorkflowProgress(project?: Project | null): WorkflowProgress {
  const scenes = project?.storyboard?.scenes || [];
  const scenesWithImages = scenes.filter(scene => Boolean(scene.generatedImage?.url)).length;
  const scenesWithVideos = scenes.filter(scene => Boolean(scene.generatedVideo?.url)).length;
  const scenesSkippingImage = scenes.filter(sceneSkipsImageStage).length;
  const totalScenes = scenes.length;
  // 每個場景要嘛有首幀，要嘛 videoMode 本身就跳過圖片 stage
  const imageReadyCount = scenesWithImages + scenesSkippingImage;
  const allImagesReady = totalScenes > 0 && imageReadyCount >= totalScenes;
  const allVideosReady = totalScenes > 0 && scenesWithVideos === totalScenes;

  return {
    hasStoryboard: !!project?.storyboard,
    totalScenes,
    scenesWithImages,
    scenesWithVideos,
    scenesSkippingImage,
    hasImages: allImagesReady,
    hasVideos: allVideosReady,
  };
}
