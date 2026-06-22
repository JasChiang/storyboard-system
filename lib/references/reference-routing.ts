import type { ProjectReference, Scene, ViewIntent } from '@/lib/types/storyboard';
import { getReferenceTag, getSceneRequiredTags, inferSceneViewIntent, getSceneRelevantReferences } from '@/lib/references/scene-references';
import { getReferencePlanItemForTag } from '@/lib/references/reference-plan';

function rankReference(reference: ProjectReference, intent: ViewIntent): number {
  if (!reference.angle || intent === 'auto') return 1;
  if (reference.angle === intent) return 4;
  if ((intent === 'side_left' || intent === 'side_right') && reference.angle === 'side') return 3;
  if (intent === 'side' && (reference.angle === 'side_left' || reference.angle === 'side_right')) return 3;
  if (intent === 'side_left' && reference.angle === 'side_right') return 1;
  if (intent === 'side_right' && reference.angle === 'side_left') return 1;
  if (intent === 'three_quarter' && (reference.angle === 'front' || reference.angle === 'side' || reference.angle === 'side_left' || reference.angle === 'side_right')) return 3;
  if (intent === 'front' && reference.angle === 'three_quarter') return 2;
  if ((intent === 'side' || intent === 'side_left' || intent === 'side_right') && reference.angle === 'three_quarter') return 2;
  if (intent === 'back' && (reference.angle === 'side' || reference.angle === 'side_left' || reference.angle === 'side_right')) return 2;
  return 0;
}

function getReferenceSpecificIntent(scene: Partial<Pick<Scene, 'referenceViewHints' | 'viewIntent'>>, reference: ProjectReference, fallback: ViewIntent): ViewIntent {
  const refTag = getReferenceTag(reference);
  const planned = refTag
    ? getReferencePlanItemForTag(
      scene as Pick<Scene, 'referencePlan' | 'referenceViewHints' | 'viewIntent' | 'requiredReferences' | 'charactersUsed' | 'productsUsed'>,
      refTag
    )
    : undefined;
  if (planned?.requestedView) return planned.requestedView;
  if (refTag && scene.referenceViewHints && typeof scene.referenceViewHints === 'object') {
    const hinted = scene.referenceViewHints[refTag];
    if (hinted) return hinted;
  }
  return fallback;
}

export function splitSceneReferencesByPriority(
  scene: Pick<Scene, 'description' | 'charactersUsed' | 'productsUsed' | 'requiredReferences' | 'referencePlan'> & Partial<Pick<Scene, 'cameraMovement' | 'shotIntent' | 'startComposition' | 'viewIntent' | 'referenceViewHints'>>,
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

  const sorted = [...relevant].sort((a, b) => rankReference(b, getReferenceSpecificIntent(scene, b, viewIntent)) - rankReference(a, getReferenceSpecificIntent(scene, a, viewIntent)));
  let primary = sorted.filter((ref) => rankReference(ref, getReferenceSpecificIntent(scene, ref, viewIntent)) >= 3);
  let secondary = sorted.filter((ref) => rankReference(ref, getReferenceSpecificIntent(scene, ref, viewIntent)) < 3);

  const hasCharactersInScene = (scene.charactersUsed || []).length > 0;
  const hasProductsInScene = (scene.productsUsed || []).length > 0;
  const requiredTags = getSceneRequiredTags(scene);

  const ensureEntityCoverage = (type: ProjectReference['type']) => {
    const alreadyCovered = primary.some((ref) => ref.type === type);
    if (alreadyCovered) return;
    const candidate = sorted.find((ref) => {
      if (ref.type !== type) return false;
      const refTag = getReferenceTag(ref);
      if (!refTag) return true;
      if (requiredTags.size === 0) return true;
      return requiredTags.has(refTag) || (type === 'character' && (scene.charactersUsed || []).includes(refTag)) || (type === 'product' && (scene.productsUsed || []).includes(refTag));
    });
    if (!candidate) return;
    primary = [...primary, candidate];
    secondary = secondary.filter((ref) => ref.id !== candidate.id);
  };

  if (hasCharactersInScene) ensureEntityCoverage('character');
  if (hasProductsInScene) ensureEntityCoverage('product');

  if (primary.length === 0) {
    primary = sorted.slice(0, 1);
    secondary = sorted.slice(1);
  }

  return {
    viewIntent,
    primary,
    secondary,
    all: [...primary, ...secondary.filter((ref) => !primary.some((item) => item.id === ref.id))],
  };
}
