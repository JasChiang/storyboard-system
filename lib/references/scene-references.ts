import type { ProjectReference, Scene } from '@/lib/types/storyboard';

const TAG_PATTERN = /<([^>]+)>/g;

function normalizeTag(raw: string): string {
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

function getReferenceTag(reference: ProjectReference): string {
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

export function getSceneRelevantReferences(
  scene: Pick<Scene, 'description' | 'charactersUsed' | 'productsUsed'>,
  references: ProjectReference[]
): ProjectReference[] {
  if (!references.length) return [];

  const sceneTags = getSceneEntityTags(scene);
  if (!sceneTags.size) return references;

  const matched = references.filter((reference) => {
    const tag = getReferenceTag(reference);
    return tag ? sceneTags.has(tag) : false;
  });

  return matched.length > 0 ? matched : references;
}
