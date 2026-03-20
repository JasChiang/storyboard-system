import type { Scene } from '@/lib/types/storyboard';
import { buildSceneReferencePlanLines } from '@/lib/references/reference-plan';

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
  | 'viewIntent'
  | 'referenceViewHints'
  | 'requiredReferences'
  | 'charactersUsed'
  | 'productsUsed'
  | 'referencePlan'
>;

function normalize(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pushIfPresent(lines: string[], label: string, value?: string) {
  const text = normalize(value);
  if (!text) return;
  lines.push(`${label}: ${text}`);
}

function pushList(lines: string[], label: string, values?: string[]) {
  const cleaned = Array.isArray(values)
    ? values.map((value) => normalize(value)).filter(Boolean)
    : [];
  if (cleaned.length === 0) return;
  lines.push(`${label}: ${cleaned.join(', ')}`);
}

function pushReferenceViewHints(
  lines: string[],
  hints?: Scene['referenceViewHints']
) {
  if (!hints || typeof hints !== 'object') return;
  const entries = Object.entries(hints)
    .map(([tag, view]) => {
      const normalizedTag = normalize(tag);
      const normalizedView = normalize(view);
      if (!normalizedTag || !normalizedView) return '';
      return `${normalizedTag} => ${normalizedView}`;
    })
    .filter(Boolean);
  if (entries.length === 0) return;
  lines.push(`Per-reference view hints: ${entries.join(' | ')}`);
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
  pushIfPresent(lines, 'Shot view intent', scene.viewIntent);
  pushReferenceViewHints(lines, scene.referenceViewHints);
  buildSceneReferencePlanLines(scene.referencePlan).forEach((line) => {
    lines.push(`Resolved reference plan: ${line}`);
  });
  pushList(lines, 'Characters used', scene.charactersUsed);
  pushList(lines, 'Products used', scene.productsUsed);
  pushList(lines, 'Required references', scene.requiredReferences);

  const cameraMovement = normalize(scene.cameraMovement);
  if (cameraMovement) {
    lines.push(`Camera framing intent: ${cameraMovement} (use as framing target only; this is a still frame).`);
  }

  if (lines.length === 0) return [];
  return ['Scene directives:', ...lines];
}
