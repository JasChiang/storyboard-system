import type { ProjectReference, Scene, ViewIntent } from '@/lib/types/storyboard';

const TAG_PATTERN = /<([^>]+)>/g;

export function normalizeTag(raw: string): string {
  const trimmed = raw.replace(/^<|>$/g, '').trim().toLowerCase();
  return trimmed ? `<${trimmed}>` : '';
}

function addTag(set: Set<string>, raw?: string) {
  if (!raw) return;
  const normalized = normalizeTag(raw);
  if (normalized) set.add(normalized);
}

function extractTagsFromText(text: string): Set<string> {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = TAG_PATTERN.exec(text)) !== null) {
    if (match[1]) addTag(tags, match[1]);
  }
  return tags;
}

export function getReferenceTag(reference: Pick<ProjectReference, 'name'>): string {
  return reference.name ? normalizeTag(reference.name) : '';
}

export function getSceneEntityTags(
  scene: Pick<Scene, 'description' | 'charactersUsed' | 'productsUsed' | 'referencePlan'>
): Set<string> {
  const tags = extractTagsFromText(scene.description || '');

  (scene.charactersUsed || []).forEach((tag) => addTag(tags, tag));
  (scene.productsUsed || []).forEach((tag) => addTag(tags, tag));
  (scene.referencePlan || []).forEach((item) => addTag(tags, item.tag));

  return tags;
}

export function getSceneRequiredTags(
  scene: Pick<Scene, 'requiredReferences' | 'referencePlan'>
): Set<string> {
  const tags = new Set<string>();
  (scene.requiredReferences || []).forEach((tag) => addTag(tags, tag));
  (scene.referencePlan || []).forEach((item) => {
    if (item.required) addTag(tags, item.tag);
  });
  return tags;
}

export function inferSceneViewIntent(
  scene: Pick<Scene, 'description' | 'viewIntent'> & Partial<Pick<Scene, 'cameraMovement' | 'shotIntent' | 'startComposition'>>
): ViewIntent {
  if (scene.viewIntent && scene.viewIntent !== 'auto') return scene.viewIntent;
  const haystack = [scene.description, scene.cameraMovement, scene.shotIntent, scene.startComposition]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (/top view|top-down|bird'?s-eye|俯視|頂視|平鋪/.test(haystack)) return 'top';
  if (/back view|from behind|rear|背面|背影/.test(haystack)) return 'back';
  if (/three[-\s]?quarter|3\/4|angled hero|斜角|三分之四/.test(haystack)) return 'three_quarter';
  if (/profile|side view|側面|側拍|側臉/.test(haystack)) return 'side';
  if (/front view|front-facing|facing camera|正面|面向鏡頭/.test(haystack)) return 'front';
  return 'auto';
}

function rankReferenceForViewIntent(reference: ProjectReference, intent: ViewIntent): number {
  if (!reference.angle || intent === 'auto') return 1;
  if (reference.angle === intent) return 4;
  if (intent === 'three_quarter' && (reference.angle === 'front' || reference.angle === 'side')) return 3;
  if (intent === 'front' && reference.angle === 'three_quarter') return 2;
  if (intent === 'side' && reference.angle === 'three_quarter') return 2;
  if (intent === 'back' && reference.angle === 'side') return 2;
  return 0;
}

export function getSceneRelevantReferences(
  scene: Pick<Scene, 'description' | 'charactersUsed' | 'productsUsed' | 'requiredReferences' | 'referencePlan'> & Partial<Pick<Scene, 'cameraMovement' | 'shotIntent' | 'startComposition' | 'viewIntent'>>,
  references: ProjectReference[],
  options?: {
    fallbackPolicy?: 'environment_only' | 'non_environment' | 'all_selected';
  }
): ProjectReference[] {
  if (!references.length) return [];
  const fallbackPolicy = options?.fallbackPolicy || 'environment_only';
  const fallbackReferences = () => {
    if (fallbackPolicy === 'all_selected') {
      return references;
    }
    if (fallbackPolicy === 'non_environment') {
      const nonEnvironment = references.filter((reference) => reference.type !== 'environment');
      return nonEnvironment.length > 0 ? nonEnvironment : references.filter((reference) => reference.type === 'environment');
    }
    // Default: environment-only fallback to avoid identity contamination.
    return references.filter((reference) => reference.type === 'environment');
  };

  const requiredTags = getSceneRequiredTags(scene);
  const viewIntent = inferSceneViewIntent(scene);

  if (requiredTags.size > 0) {
    const requiredMatched = references.filter((reference) => {
      const tag = getReferenceTag(reference);
      return tag ? requiredTags.has(tag) : false;
    });
    return [...requiredMatched].sort((a, b) => rankReferenceForViewIntent(b, viewIntent) - rankReferenceForViewIntent(a, viewIntent));
  }

  const sceneTags = getSceneEntityTags(scene);
  if (!sceneTags.size) {
    return fallbackReferences();
  }

  const matched = references.filter((reference) => {
    const tag = getReferenceTag(reference);
    return tag ? sceneTags.has(tag) : false;
  });

  if (matched.length > 0) {
    return [...matched].sort((a, b) => rankReferenceForViewIntent(b, viewIntent) - rankReferenceForViewIntent(a, viewIntent));
  }

  // If entity tags do not match any reference, use fallback policy.
  return [...fallbackReferences()].sort((a, b) => rankReferenceForViewIntent(b, viewIntent) - rankReferenceForViewIntent(a, viewIntent));
}
