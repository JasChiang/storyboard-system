import type { ProjectReference, Scene } from '@/lib/types/storyboard';

const CAMERA_MOVE_PATTERN = /\b(pan|tilt|zoom|dolly|truck|orbit|track|push in|push out|pull in|pull out)\b/i;
const OBJECT_MOTION_PATTERN = /\b(move|moving|walk|walking|run|running|jump|turn|rotate|spin|fly|open|close|swing)\b/i;
const WALL_MOUNTED_PATTERN = /\b(wall[-\s]?mounted|air\s*conditioner|ac\s*unit|split\s*type)\b/i;
const WALL_MOUNTED_PATTERN_ZH = /(壁掛|掛壁|冷氣|空調|分離式)/;

function hasWallMountedProduct(refs: ProjectReference[]): boolean {
  return refs.some((ref) => {
    if (ref.type !== 'product') return false;
    const blob = [
      ref.name,
      ref.description,
      ref.identityCore,
      ref.guidelines,
      ...(ref.mustKeepFeatures || []),
    ].filter(Boolean).join(' ');
    return WALL_MOUNTED_PATTERN.test(blob) || WALL_MOUNTED_PATTERN_ZH.test(blob);
  });
}

export function buildMotionSafetyLines(input: {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
}): string[] {
  const { scene, motionPrompt, scopedRefs } = input;
  const lines: string[] = [];
  const hasCameraMove = CAMERA_MOVE_PATTERN.test(motionPrompt || '');
  const hasObjectMotionRequest = OBJECT_MOTION_PATTERN.test(motionPrompt || '');
  const wallMountedProduct = hasWallMountedProduct(scopedRefs);

  if (hasCameraMove) {
    lines.push('Camera-only motion: parallax and framing changes must come from camera movement, not object drift.');
  }

  if (wallMountedProduct && !hasObjectMotionRequest) {
    lines.push('The wall-mounted unit must remain physically fixed to the wall: no translation, no rotation, no scaling, no deformation.');
  }

  if (!scene.requiresEndFrame) {
    lines.push('Keep the primary anchored product/world position stable throughout the shot.');
  }

  return lines;
}
