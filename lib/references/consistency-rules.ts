import type { ProjectReference } from '@/lib/types/storyboard';

export interface ConsolidatedReferenceRule {
  type: 'character' | 'product';
  tag: string; // e.g. <Alice>
  name: string;
  identityCore?: string;
  mustKeepFeatures: string[];
  guidelines: string[];
  sourceRefIds: string[];
}

function splitGuidelines(guidelines?: string): string[] {
  if (!guidelines) return [];
  return guidelines
    .split(/\n|；|;|。/)
    .map(item => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter(value => {
    const key = value.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Consolidate multiple references (multi-angle / repeated uploads) into stable character/product rules.
 * Priority:
 * 1) first non-empty identityCore (usually user-curated)
 * 2) merged mustKeepFeatures
 * 3) merged guideline lines
 */
export function buildConsolidatedReferenceRules(
  references?: ProjectReference[]
): ConsolidatedReferenceRule[] {
  if (!references?.length) return [];

  const groups = new Map<string, ConsolidatedReferenceRule>();

  for (const ref of references) {
    if ((ref.type !== 'character' && ref.type !== 'product') || !ref.name?.trim()) continue;

    const name = ref.name.trim();
    const key = `${ref.type}:${name.toLowerCase()}`;
    const tag = `<${name}>`;
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        type: ref.type,
        tag,
        name,
        identityCore: ref.identityCore?.trim() || undefined,
        mustKeepFeatures: uniqueStrings([...(ref.mustKeepFeatures || [])]),
        guidelines: uniqueStrings(splitGuidelines(ref.guidelines)),
        sourceRefIds: [ref.id],
      });
      continue;
    }

    if (!current.identityCore && ref.identityCore?.trim()) {
      current.identityCore = ref.identityCore.trim();
    }

    current.mustKeepFeatures = uniqueStrings([
      ...current.mustKeepFeatures,
      ...(ref.mustKeepFeatures || []),
    ]);
    current.guidelines = uniqueStrings([
      ...current.guidelines,
      ...splitGuidelines(ref.guidelines),
    ]);
    current.sourceRefIds = uniqueStrings([...current.sourceRefIds, ref.id]);
  }

  return [...groups.values()];
}

