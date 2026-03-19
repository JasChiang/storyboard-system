import type { CharacterLibraryItem } from '@/lib/types/character-library';
import { normalizeCharacterItem } from '@/lib/characters/workflow';

export function buildCharacterLibraryItem(input: Partial<CharacterLibraryItem>, now = new Date().toISOString()): CharacterLibraryItem {
  const type = input.type as CharacterLibraryItem['type'];
  return normalizeCharacterItem({
    id: input.id || crypto.randomUUID(),
    name: String(input.name || ''),
    type,
    description: String(input.description || ''),
    guidelines: input.guidelines,
    tags: Array.isArray(input.tags) ? input.tags : [],
    views: Array.isArray(input.views) ? input.views : [],
    ipProfile: input.ipProfile,
    usageCount: typeof input.usageCount === 'number' ? input.usageCount : 0,
    version: typeof input.version === 'number' && input.version > 0 ? Math.floor(input.version) : 1,
    currentSnapshotId: input.currentSnapshotId || `snapshot-${crypto.randomUUID()}`,
    createdAt: input.createdAt || now,
    updatedAt: now,
  });
}
