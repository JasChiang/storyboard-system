import { describe, expect, it } from 'vitest';
import { buildGlobalContinuityDraft } from '@/lib/storyboard/global-continuity-draft';
import { migrateCharacterLibrary, normalizeProjectReferenceWorkflow } from '@/lib/characters/workflow';
import type { CharacterLibrary } from '@/lib/types/character-library';
import type { ProjectReference } from '@/lib/types/storyboard';

describe('character workflow migration', () => {
  it('fills missing character status during migration', () => {
    const library = migrateCharacterLibrary({
      version: 1,
      items: [
        {
          id: 'char-1',
          name: 'Alice',
          type: 'character',
          description: 'hero',
          tags: [],
          status: 'draft',
          views: [{ angle: 'front', url: 'https://example.com/a.jpg', description: 'front' }],
          version: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          usageCount: 0,
        },
      ],
    } as CharacterLibrary);

    expect(library.version).toBeGreaterThanOrEqual(2);
    expect(library.items[0].status).toBe('draft');
  });
});

describe('continuity draft workflow roles', () => {
  it('prioritizes anchor references and carries usage roles into directives', () => {
    const references: ProjectReference[] = [
      normalizeProjectReferenceWorkflow({
        id: 'ref-2',
        url: 'https://example.com/support.jpg',
        description: 'supporting product',
        type: 'product',
        name: 'Bottle',
        descriptionSource: 'manual',
        isAnchor: false,
        usageRole: 'supporting',
      }),
      normalizeProjectReferenceWorkflow({
        id: 'ref-1',
        url: 'https://example.com/anchor.jpg',
        description: 'anchor character',
        type: 'character',
        name: 'Alice',
        descriptionSource: 'manual',
        identityCore: 'round face',
        isAnchor: true,
        usageRole: 'anchor',
      }),
    ];

    const draft = buildGlobalContinuityDraft(references, null);

    expect(draft.sharedAnchors[0]).toContain('Alice');
    expect(draft.sharedAnchors[0]).toContain('anchor');
    expect(draft.sharedContinuityDirectives.some((item) => item.directive.includes('workflow role: anchor'))).toBe(true);
    expect(draft.sharedContinuityDirectives.some((item) => item.directive.includes('workflow role: supporting'))).toBe(true);
  });
});
