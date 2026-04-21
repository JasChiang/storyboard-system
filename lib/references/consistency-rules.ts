import type { ProjectReference } from '@/lib/types/storyboard';
import type { StructuredIdentityLock } from '@/lib/types/storyboard';
import { buildStructuredIdentityLock, mergeStructuredIdentityLocks } from '@/lib/references/identity-lock';

export interface ConsolidatedReferenceRule {
  type: 'character' | 'product';
  tag: string; // e.g. <Alice>
  name: string;
  identityCore?: string;
  mustKeepFeatures: string[];
  guidelines: string[];
  structuredIdentityLock?: StructuredIdentityLock;
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

function splitIdentityCore(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/\n|；|;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeIdentityCore(existing?: string, incoming?: string): string | undefined {
  const merged = uniqueStrings([
    ...splitIdentityCore(existing),
    ...splitIdentityCore(incoming),
  ]);
  if (merged.length === 0) return undefined;
  return merged.join('; ');
}

/**
 * Consolidate multiple references (multi-angle / repeated uploads) into stable character/product rules.
 * Priority:
 * 1) merged identityCore across angles (dedup; distinct angle anchors are preserved)
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
      const derivedLock = ref.structuredIdentityLock || buildStructuredIdentityLock(ref);
      groups.set(key, {
        type: ref.type,
        tag,
        name,
        identityCore: mergeIdentityCore(undefined, ref.identityCore),
        mustKeepFeatures: uniqueStrings([...(ref.mustKeepFeatures || [])]),
        guidelines: uniqueStrings(splitGuidelines(ref.guidelines)),
        structuredIdentityLock: derivedLock,
        sourceRefIds: [ref.id],
      });
      continue;
    }

    current.identityCore = mergeIdentityCore(current.identityCore, ref.identityCore);

    current.mustKeepFeatures = uniqueStrings([
      ...current.mustKeepFeatures,
      ...(ref.mustKeepFeatures || []),
    ]);
    current.guidelines = uniqueStrings([
      ...current.guidelines,
      ...splitGuidelines(ref.guidelines),
    ]);
    current.structuredIdentityLock = mergeStructuredIdentityLocks(
      current.structuredIdentityLock,
      ref.structuredIdentityLock || buildStructuredIdentityLock(ref)
    );
    current.sourceRefIds = uniqueStrings([...current.sourceRefIds, ref.id]);
  }

  return [...groups.values()];
}
