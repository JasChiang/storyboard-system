import type { ProjectReference, Scene } from '@/lib/types/storyboard';

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
  scene: Pick<Scene, 'description' | 'charactersUsed' | 'productsUsed'>
): Set<string> {
  const tags = extractTagsFromText(scene.description || '');

  (scene.charactersUsed || []).forEach((tag) => addTag(tags, tag));
  (scene.productsUsed || []).forEach((tag) => addTag(tags, tag));

  return tags;
}

export function getSceneRequiredTags(
  scene: Pick<Scene, 'requiredReferences'>
): Set<string> {
  const tags = new Set<string>();
  (scene.requiredReferences || []).forEach((tag) => addTag(tags, tag));
  return tags;
}

export function getSceneRelevantReferences(
  scene: Pick<Scene, 'description' | 'charactersUsed' | 'productsUsed' | 'requiredReferences'>,
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
  if (requiredTags.size > 0) {
    const requiredMatched = references.filter((reference) => {
      const tag = getReferenceTag(reference);
      return tag ? requiredTags.has(tag) : false;
    });
    return requiredMatched;
  }

  const sceneTags = getSceneEntityTags(scene);
  if (!sceneTags.size) {
    return fallbackReferences();
  }

  const matched = references.filter((reference) => {
    const tag = getReferenceTag(reference);
    return tag ? sceneTags.has(tag) : false;
  });

  if (matched.length > 0) return matched;

  // If entity tags do not match any reference, use fallback policy.
  return fallbackReferences();
}
