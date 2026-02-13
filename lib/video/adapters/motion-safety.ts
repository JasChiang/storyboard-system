import type { ProjectReference, Scene } from '@/lib/types/storyboard';

const CAMERA_MOVE_PATTERN = /\b(pan|tilt|zoom|dolly|truck|orbit|track|push in|push out|pull in|pull out)\b/i;
const OBJECT_MOTION_PATTERN = /\b(move|moving|walk|walking|run|running|jump|turn|rotate|spin|fly|open|close|swing)\b/i;
const WALL_MOUNTED_PATTERN = /\b(wall[-\s]?mounted|air\s*conditioner|ac\s*unit|split\s*type)\b/i;
const WALL_MOUNTED_PATTERN_ZH = /(壁掛|掛壁|冷氣|空調|分離式)/;
const CROSS_SUBJECT_PATTERN = /\bfrom\b.+\bto\b.+/i;
const CROSS_SUBJECT_PATTERN_ZH = /(從.+到.+)|(由.+到.+)/;
const FAMILY_TARGET_PATTERN = /\b(family|parents?|kids?|children|people)\b/i;
const FAMILY_TARGET_PATTERN_ZH = /(家人|家庭|父母|孩子)/;

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

export interface MotionRiskAnalysis {
  hasCameraMove: boolean;
  hasObjectMotionRequest: boolean;
  wallMountedProduct: boolean;
  riskyCrossSubjectHandoff: boolean;
}

export function analyzeMotionRisk(input: {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
}): MotionRiskAnalysis {
  const { scene, motionPrompt, scopedRefs } = input;
  const hasCameraMove = CAMERA_MOVE_PATTERN.test(motionPrompt || '');
  const hasObjectMotionRequest = OBJECT_MOTION_PATTERN.test(motionPrompt || '');
  const wallMountedProduct = hasWallMountedProduct(scopedRefs);
  const crossSubject = CROSS_SUBJECT_PATTERN.test(motionPrompt || '')
    || CROSS_SUBJECT_PATTERN_ZH.test(motionPrompt || '');
  const familyTarget = FAMILY_TARGET_PATTERN.test(motionPrompt || '')
    || FAMILY_TARGET_PATTERN_ZH.test(motionPrompt || '');
  const riskyCrossSubjectHandoff = wallMountedProduct
    && !scene.requiresEndFrame
    && hasCameraMove
    && crossSubject
    && familyTarget;

  return {
    hasCameraMove,
    hasObjectMotionRequest,
    wallMountedProduct,
    riskyCrossSubjectHandoff,
  };
}

export function buildMotionSafetyLines(input: {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
}): string[] {
  const { scene } = input;
  const lines: string[] = [];
  const {
    hasCameraMove,
    hasObjectMotionRequest,
    wallMountedProduct,
    riskyCrossSubjectHandoff,
  } = analyzeMotionRisk(input);

  if (hasCameraMove) {
    lines.push('Camera-only motion: parallax and framing changes must come from camera movement, not object drift.');
  }

  if (wallMountedProduct && !hasObjectMotionRequest) {
    lines.push('The wall-mounted unit must remain physically fixed to the wall: no translation, no rotation, no scaling, no deformation.');
  }

  if (riskyCrossSubjectHandoff) {
    lines.push('This shot is a limited reframe within currently visible content. Do not force full subject handoff if target subjects are out of frame.');
    lines.push('Never move, rotate, or scale the anchored wall-mounted unit to satisfy reframing.');
  }

  if (!scene.requiresEndFrame) {
    lines.push('Keep the primary anchored product/world position stable throughout the shot.');
  }

  return lines;
}
