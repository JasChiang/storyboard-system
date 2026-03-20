import type { Scene } from '@/lib/types/storyboard';
import { buildSceneReferencePlanLines } from '@/lib/references/reference-plan';

type SceneScriptSource = Pick<
  Scene,
  | 'description'
  | 'sceneIntent'
  | 'startComposition'
  | 'subjectMotion'
  | 'continuityLock'
  | 'shotIntent'
  | 'continuityAnchor'
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

function addLine(target: string[], label: string, value?: string) {
  const text = normalize(value);
  if (!text) return;
  target.push(`${label}: ${text}`);
}

function addList(target: string[], label: string, values?: string[]) {
  const cleaned = Array.isArray(values)
    ? values.map((value) => normalize(value)).filter(Boolean)
    : [];
  if (cleaned.length === 0) return;
  target.push(`${label}: ${cleaned.join(', ')}`);
}

function addReferenceViewHints(
  target: string[],
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
  target.push(`Reference view hints: ${entries.join(' | ')}`);
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
  addLine(lines, 'Shot view intent', scene.viewIntent);
  addReferenceViewHints(lines, scene.referenceViewHints);
  buildSceneReferencePlanLines(scene.referencePlan).forEach((line) => {
    lines.push(`Resolved reference plan: ${line}`);
  });
  addList(lines, 'Characters used', scene.charactersUsed);
  addList(lines, 'Products used', scene.productsUsed);
  addList(lines, 'Required references', scene.requiredReferences);
  return lines;
}
