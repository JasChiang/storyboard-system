import type { Scene } from '@/lib/types/storyboard';

type VideoSceneSource = Pick<
  Scene,
  | 'subjectMotion'
  | 'sceneIntent'
  | 'continuityLock'
>;

function normalize(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Build scene script lines for video generation.
 *
 * For image-to-video, the start frame image already provides the visual scene.
 * The prompt should only describe MOTION, CHANGES, and CONSTRAINTS — never
 * re-describe static visual content that the model can already see.
 */
export function buildVideoSceneScriptLines(scene: VideoSceneSource): string[] {
  const lines: string[] = [];

  // Subject motion is the core: what moves and how
  const subjectMotion = normalize(scene.subjectMotion);
  if (subjectMotion) {
    lines.push(subjectMotion);
  }

  // Scene intent provides narrative context for the motion
  const sceneIntent = normalize(scene.sceneIntent);
  if (sceneIntent) {
    lines.push(`Scene goal: ${sceneIntent}`);
  }

  // Continuity lock tells what must NOT change
  const continuityLock = normalize(scene.continuityLock);
  if (continuityLock) {
    lines.push(`Keep unchanged: ${continuityLock}`);
  }

  return lines;
}
