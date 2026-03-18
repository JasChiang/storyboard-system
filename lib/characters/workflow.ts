import type { CharacterLibrary, CharacterLibraryItem } from '@/lib/types/character-library';
import type { ProjectReference } from '@/lib/types/storyboard';

export const CHARACTER_LIBRARY_SCHEMA_VERSION = 2;

export type CharacterLibraryStatus = 'draft' | 'reviewed' | 'production_ready' | 'archived';
export type ReferenceUsageRole = 'anchor' | 'supporting' | 'style_support';

export const CHARACTER_STATUS_LABELS: Record<CharacterLibraryStatus, string> = {
  draft: '草稿',
  reviewed: '已審核',
  production_ready: '可投產',
  archived: '封存',
};

export const REFERENCE_USAGE_ROLE_LABELS: Record<ReferenceUsageRole, string> = {
  anchor: 'Anchor role',
  supporting: 'Usage role',
  style_support: 'Style support',
};

export function normalizeCharacterStatus(status?: string | null): CharacterLibraryStatus {
  switch (status) {
    case 'reviewed':
    case 'production_ready':
    case 'archived':
      return status;
    case 'draft':
    default:
      return 'draft';
  }
}

export function inferFallbackAnchorRole(item: Pick<CharacterLibraryItem, 'type' | 'status'>): boolean {
  const status = normalizeCharacterStatus(item.status);
  return (item.type === 'character' || item.type === 'product') && status === 'production_ready';
}

export function inferFallbackUsageRole(item: Pick<CharacterLibraryItem, 'type'>): ReferenceUsageRole {
  if (item.type === 'style') return 'style_support';
  return 'supporting';
}

export function normalizeCharacterItem<T extends Partial<CharacterLibraryItem>>(item: T): T & Pick<CharacterLibraryItem, 'status'> {
  return {
    ...item,
    status: normalizeCharacterStatus(item.status),
  };
}

export function migrateCharacterLibrary(library: CharacterLibrary): CharacterLibrary {
  const items = Array.isArray(library.items) ? library.items.map((item) => normalizeCharacterItem(item)) : [];
  return {
    items,
    version: Math.max(Number(library.version || 0), CHARACTER_LIBRARY_SCHEMA_VERSION),
  };
}

export function normalizeProjectReferenceWorkflow(reference: ProjectReference): ProjectReference {
  const usageRole = reference.usageRole || (reference.type === 'style' ? 'style_support' : 'supporting');
  const isAnchor = typeof reference.isAnchor === 'boolean'
    ? reference.isAnchor
    : (reference.type === 'character' || reference.type === 'product') && usageRole === 'anchor';

  return {
    ...reference,
    usageRole,
    isAnchor,
  };
}

export function sortReferencesForContinuityDraft(projectReferences: ProjectReference[] = []): ProjectReference[] {
  return [...projectReferences]
    .filter(Boolean)
    .map(normalizeProjectReferenceWorkflow)
    .sort((a, b) => {
      const anchorWeight = Number(b.isAnchor) - Number(a.isAnchor);
      if (anchorWeight !== 0) return anchorWeight;
      const roleWeight = (a.usageRole || '').localeCompare(b.usageRole || '');
      if (roleWeight !== 0) return roleWeight;
      return (a.name || '').localeCompare(b.name || '');
    });
}
