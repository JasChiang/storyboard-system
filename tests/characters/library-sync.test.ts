import { describe, expect, it } from 'vitest';
import { diffProjectReferencesAgainstLibrary, summarizeLibraryDiffs } from '@/lib/characters/library-sync';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import type { ProjectReference } from '@/lib/types/storyboard';

const mkRef = (overrides: Partial<ProjectReference>): ProjectReference => ({
    id: overrides.id || 'ref-1',
    name: overrides.name || 'Alice',
    type: overrides.type || 'character',
    url: overrides.url || 'https://x/a.png',
    description: overrides.description || '',
    descriptionSource: overrides.descriptionSource || 'manual',
    sourceCharacterLibraryItemId: overrides.sourceCharacterLibraryItemId,
    sourceCharacterLibraryVersion: overrides.sourceCharacterLibraryVersion,
    sourceCharacterSnapshotId: overrides.sourceCharacterSnapshotId,
    ...overrides,
});

const mkItem = (overrides: Partial<CharacterLibraryItem>): CharacterLibraryItem => ({
    id: overrides.id || 'item-1',
    name: overrides.name || 'Alice',
    type: overrides.type || 'character',
    status: overrides.status || 'production_ready',
    description: overrides.description || '',
    tags: overrides.tags || [],
    views: overrides.views || [],
    version: overrides.version ?? 1,
    currentSnapshotId: overrides.currentSnapshotId,
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
    usageCount: overrides.usageCount ?? 0,
    ...overrides,
});

describe('diffProjectReferencesAgainstLibrary', () => {
    it('returns empty when references have no library source', () => {
        const refs = [mkRef({ id: 'r1' })];
        const items = [mkItem({})];
        expect(diffProjectReferencesAgainstLibrary(refs, items)).toEqual([]);
    });

    it('skips references whose library item is not present', () => {
        const refs = [
            mkRef({ id: 'r1', sourceCharacterLibraryItemId: 'missing', sourceCharacterLibraryVersion: 1 }),
        ];
        expect(diffProjectReferencesAgainstLibrary(refs, [])).toEqual([]);
    });

    it('returns no diff when versions and snapshots match', () => {
        const refs = [
            mkRef({
                id: 'r1',
                angle: 'front',
                sourceCharacterLibraryItemId: 'item-1',
                sourceCharacterLibraryVersion: 3,
                sourceCharacterSnapshotId: 'snap-3',
                identityCore: 'red hair',
                mustKeepFeatures: ['bow'],
                url: 'https://x/a.png',
            }),
        ];
        const items = [
            mkItem({
                id: 'item-1',
                version: 3,
                currentSnapshotId: 'snap-3',
                views: [
                    { angle: 'front', url: 'https://x/a.png', description: '', identityCore: 'red hair', mustKeepFeatures: ['bow'] },
                ],
            }),
        ];
        expect(diffProjectReferencesAgainstLibrary(refs, items)).toEqual([]);
    });

    it('detects version bump and new angles', () => {
        const refs = [
            mkRef({
                id: 'r1',
                angle: 'front',
                sourceCharacterLibraryItemId: 'item-1',
                sourceCharacterLibraryVersion: 2,
                sourceCharacterSnapshotId: 'snap-2',
            }),
        ];
        const items = [
            mkItem({
                id: 'item-1',
                version: 5,
                currentSnapshotId: 'snap-5',
                views: [
                    { angle: 'front', url: 'https://x/front.png', description: '' },
                    { angle: 'side', url: 'https://x/side.png', description: '' },
                    { angle: 'back', url: 'https://x/back.png', description: '' },
                ],
            }),
        ];
        const diffs = diffProjectReferencesAgainstLibrary(refs, items);
        expect(diffs).toHaveLength(1);
        expect(diffs[0].newAngles.sort()).toEqual(['back', 'side']);
        expect(diffs[0].latestVersion).toBe(5);
        expect(diffs[0].currentVersion).toBe(2);
        expect(diffs[0].changes.some((c) => c.includes('版本 2 → 5'))).toBe(true);
        expect(diffs[0].changes.some((c) => c.includes('新增 2 個視角'))).toBe(true);
        expect(diffs[0].affectedReferenceIds).toEqual(['r1']);
    });

    it('detects identityCore and mustKeepFeatures changes on same version when snapshot differs', () => {
        const refs = [
            mkRef({
                id: 'r1',
                angle: 'front',
                sourceCharacterLibraryItemId: 'item-1',
                sourceCharacterLibraryVersion: 3,
                sourceCharacterSnapshotId: 'snap-old',
                identityCore: 'red hair',
                mustKeepFeatures: ['bow'],
            }),
        ];
        const items = [
            mkItem({
                id: 'item-1',
                version: 3,
                currentSnapshotId: 'snap-new',
                views: [
                    {
                        angle: 'front',
                        url: 'https://x/a.png',
                        description: '',
                        identityCore: 'red hair with freckles',
                        mustKeepFeatures: ['bow', 'scar'],
                    },
                ],
            }),
        ];
        const diffs = diffProjectReferencesAgainstLibrary(refs, items);
        expect(diffs).toHaveLength(1);
        expect(diffs[0].changes).toContain('identityCore 已更新');
        expect(diffs[0].changes.some((c) => c.includes('mustKeepFeatures 新增 1 項'))).toBe(true);
    });

    it('groups multiple references for the same library item into one diff', () => {
        const refs = [
            mkRef({
                id: 'r1',
                angle: 'front',
                sourceCharacterLibraryItemId: 'item-1',
                sourceCharacterLibraryVersion: 2,
            }),
            mkRef({
                id: 'r2',
                angle: 'side',
                sourceCharacterLibraryItemId: 'item-1',
                sourceCharacterLibraryVersion: 2,
            }),
        ];
        const items = [
            mkItem({
                id: 'item-1',
                version: 3,
                views: [
                    { angle: 'front', url: 'https://x/front.png', description: '' },
                    { angle: 'side', url: 'https://x/side.png', description: '' },
                ],
            }),
        ];
        const diffs = diffProjectReferencesAgainstLibrary(refs, items);
        expect(diffs).toHaveLength(1);
        expect(diffs[0].affectedReferenceIds.sort()).toEqual(['r1', 'r2']);
        expect(diffs[0].newAngles).toEqual([]);
    });

    it('flags removed angles in changes', () => {
        const refs = [
            mkRef({
                id: 'r1',
                angle: 'back',
                sourceCharacterLibraryItemId: 'item-1',
                sourceCharacterLibraryVersion: 1,
                sourceCharacterSnapshotId: 'snap-old',
            }),
        ];
        const items = [
            mkItem({
                id: 'item-1',
                version: 2,
                currentSnapshotId: 'snap-new',
                views: [
                    { angle: 'front', url: 'https://x/front.png', description: '' },
                ],
            }),
        ];
        const diffs = diffProjectReferencesAgainstLibrary(refs, items);
        expect(diffs).toHaveLength(1);
        expect(diffs[0].changes.some((c) => c.includes('back 視角已從角色庫移除'))).toBe(true);
    });
});

describe('summarizeLibraryDiffs', () => {
    it('returns up-to-date message for empty diffs', () => {
        expect(summarizeLibraryDiffs([])).toBe('所有參考已是最新');
    });

    it('lists names when diffs exist', () => {
        const summary = summarizeLibraryDiffs([
            {
                libraryItemId: 'item-1',
                name: 'Alice',
                type: 'character',
                currentVersion: 1,
                latestVersion: 2,
                currentSnapshotId: undefined,
                latestSnapshotId: undefined,
                changes: [],
                newAngles: [],
                affectedReferenceIds: [],
            },
            {
                libraryItemId: 'item-2',
                name: 'Bob',
                type: 'character',
                currentVersion: 1,
                latestVersion: 2,
                currentSnapshotId: undefined,
                latestSnapshotId: undefined,
                changes: [],
                newAngles: [],
                affectedReferenceIds: [],
            },
        ]);
        expect(summary).toContain('2 個參考有新版');
        expect(summary).toContain('Alice');
        expect(summary).toContain('Bob');
    });
});
