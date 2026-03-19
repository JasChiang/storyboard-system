import type { ProjectReference, Scene, ViewIntent } from '@/lib/types/storyboard';
import { inferSceneViewIntent, getSceneRelevantReferences } from '@/lib/references/scene-references';

function rankReference(reference: ProjectReference, intent: ViewIntent): number {
  if (!reference.angle || intent === 'auto') return 1;
  if (reference.angle === intent) return 4;
  if (intent === 'three_quarter' && (reference.angle === 'front' || reference.angle === 'side')) return 3;
  if (intent === 'front' && reference.angle === 'three_quarter') return 2;
  if (intent === 'side' && reference.angle === 'three_quarter') return 2;
  if (intent === 'back' && reference.angle === 'side') return 2;
  return 0;
}

export function splitSceneReferencesByPriority(
  scene: Pick<Scene, 'description' | 'charactersUsed' | 'productsUsed' | 'requiredReferences'> & Partial<Pick<Scene, 'cameraMovement' | 'shotIntent' | 'startComposition' | 'viewIntent'>>,
  references: ProjectReference[],
  options?: { fallbackPolicy?: 'environment_only' | 'non_environment' | 'all_selected' }
) {
  const relevant = getSceneRelevantReferences(scene, references, options);
  const viewIntent = inferSceneViewIntent(scene);
  if (relevant.length === 0) {
    return {
      viewIntent,
      primary: [] as ProjectReference[],
      secondary: [] as ProjectReference[],
      all: [] as ProjectReference[],
    };
  }

  const sorted = [...relevant].sort((a, b) => rankReference(b, viewIntent) - rankReference(a, viewIntent));
  const primary = sorted.filter((ref) => rankReference(ref, viewIntent) >= 3);
  const secondary = sorted.filter((ref) => rankReference(ref, viewIntent) < 3);

  return {
    viewIntent,
    primary: primary.length > 0 ? primary : sorted.slice(0, 1),
    secondary: primary.length > 0 ? secondary : sorted.slice(1),
    all: sorted,
  };
}
