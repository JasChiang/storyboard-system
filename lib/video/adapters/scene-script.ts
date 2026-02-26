import type { Scene } from '@/lib/types/storyboard';

type SceneScriptSource = Pick<
  Scene,
  | 'description'
  | 'sceneIntent'
  | 'startComposition'
  | 'subjectMotion'
  | 'continuityLock'
  | 'shotIntent'
  | 'continuityAnchor'
  | 'changeFromPrev'
>;

function normalize(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

function addLine(target: string[], label: string, value?: string) {
  const text = normalize(value);
  if (!text) return;
  target.push(`${label}: ${text}`);
}

export function buildVideoSceneScriptLines(scene: SceneScriptSource): string[] {
  const lines: string[] = [];
  addLine(lines, 'Storyboard visual description', scene.description);
  addLine(lines, 'Scene intent', scene.sceneIntent);
  addLine(lines, 'Shot intent', scene.shotIntent);
  addLine(lines, 'Start composition anchor', scene.startComposition);
  addLine(lines, 'Subject motion bounds', scene.subjectMotion);
  addLine(lines, 'Continuity lock', scene.continuityLock);
  addLine(lines, 'Cross-shot continuity anchor', scene.continuityAnchor);
  addLine(lines, 'Change from previous shot', scene.changeFromPrev);
  return lines;
}

