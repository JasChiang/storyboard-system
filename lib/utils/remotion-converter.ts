import type { Scene } from '@/lib/types/storyboard';
import type { RemotionCompositionProps, RemotionSceneProps, RemotionTransitionType } from '@/lib/remotion/types';

const ASPECT_RATIOS: Record<'16:9' | '9:16' | '1:1', { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

function secondsToFrames(seconds: number, fps: number) {
  return Math.max(1, Math.round(seconds * fps));
}

function mapTransitionType(type?: string): RemotionTransitionType | undefined {
  if (!type) return undefined;
  if (type === 'wipe') return 'wipe';
  if (type === 'push') return 'slide';
  if (type === 'dissolve' || type === 'fade_black' || type === 'fade_white') return 'fade';
  return undefined;
}

function buildScene(scene: Scene, fps: number): RemotionSceneProps {
  const hasVideo = !!scene.generatedVideo?.url;
  const src = scene.generatedVideo?.url
    ?? scene.generatedImage?.url
    ?? scene.generatedEndFrame?.url
    ?? scene.referenceImage
    ?? '';

  const durationInFrames = secondsToFrames(scene.duration || 3, fps);
  const transitionType = mapTransitionType(scene.transitionToNext?.type);
  const transitionDuration = secondsToFrames(scene.transitionToNext?.duration ?? 0, fps);

  return {
    id: scene.id,
    src,
    type: hasVideo ? 'video' : 'image',
    durationInFrames,
    from: 0,
    fit: 'cover',
    transition: transitionType
      ? {
          type: transitionType,
          durationInFrames: transitionDuration,
        }
      : undefined,
    subtitle: scene.dialogue
      ? {
          text: scene.dialogue,
        }
      : undefined,
  };
}

function calculateTotalFrames(scenes: RemotionSceneProps[]) {
  if (scenes.length === 0) return 1;
  let total = 0;

  scenes.forEach((scene, index) => {
    if (index === 0) {
      total = scene.durationInFrames;
      return;
    }

    const overlap = scenes[index - 1].transition?.durationInFrames ?? 0;
    total = total - overlap + scene.durationInFrames;
  });

  return Math.max(total, 1);
}

export function convertToRemotionProps(
  scenes: Scene[],
  options: {
    fps?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
  } = {}
): RemotionCompositionProps {
  const fps = options.fps ?? 30;
  const aspectRatio = options.aspectRatio ?? '16:9';
  const { width, height } = ASPECT_RATIOS[aspectRatio];

  const remotionScenes = scenes.map(scene => buildScene(scene, fps));
  const totalFrames = calculateTotalFrames(remotionScenes);

  return {
    scenes: remotionScenes,
    width,
    height,
    fps,
    totalFrames,
  };
}

export function getRemotionTotalFrames(scenes: Scene[], fps = 30) {
  const remotionScenes = scenes.map(scene => buildScene(scene, fps));
  return calculateTotalFrames(remotionScenes);
}
