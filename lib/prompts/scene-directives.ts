import type { Scene } from '@/lib/types/storyboard';

type SceneDirectiveSource = Pick<
  Scene,
  | 'cameraMovement'
  | 'sceneIntent'
  | 'startComposition'
  | 'subjectMotion'
  | 'continuityLock'
  | 'shotIntent'
  | 'continuityAnchor'
  | 'renderLane'
  | 'productionRisk'
  | 'reservedForPost'
  | 'deliveryIntent'
  | 'referencePriorityMode'
  | 'changeFromPrev'
>;

function normalize(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pushIfPresent(lines: string[], label: string, value?: string) {
  const text = normalize(value);
  if (!text) return;
  lines.push(`${label}: ${text}`);
}

export function buildSceneDirectiveLines(scene: SceneDirectiveSource): string[] {
  const lines: string[] = [];
  pushIfPresent(lines, 'Scene intent', scene.sceneIntent);
  pushIfPresent(lines, 'Shot intent', scene.shotIntent);
  pushIfPresent(lines, 'Start composition anchor', scene.startComposition);
  pushIfPresent(lines, 'Subject motion bounds', scene.subjectMotion);
  pushIfPresent(lines, 'Continuity lock', scene.continuityLock);
  pushIfPresent(lines, 'Cross-shot continuity anchor', scene.continuityAnchor);
  pushIfPresent(lines, 'Render lane', scene.renderLane);
  pushIfPresent(lines, 'Production risk', scene.productionRisk);
  pushIfPresent(lines, 'Reserved for post', scene.reservedForPost);
  pushIfPresent(lines, 'Delivery intent', scene.deliveryIntent);
  pushIfPresent(lines, 'Reference priority mode', scene.referencePriorityMode);
  pushIfPresent(lines, 'Change from previous shot', scene.changeFromPrev);

  const cameraMovement = normalize(scene.cameraMovement);
  if (cameraMovement) {
    lines.push(`Camera framing intent: ${cameraMovement} (use as framing target only; this is a still frame).`);
  }

  if (lines.length === 0) return [];
  return ['Scene directives:', ...lines];
}

