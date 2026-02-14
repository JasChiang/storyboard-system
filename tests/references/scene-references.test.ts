import { describe, expect, it } from 'vitest';
import { getSceneEntityTags, getSceneRelevantReferences } from '@/lib/references/scene-references';
import type { ProjectReference } from '@/lib/types/storyboard';

const references: ProjectReference[] = [
  {
    id: 'ref-1',
    url: 'https://example.com/alice.png',
    type: 'character',
    name: 'Alice',
    description: 'Main character',
    descriptionSource: 'manual',
  },
  {
    id: 'ref-2',
    url: 'https://example.com/product-x.png',
    type: 'product',
    name: 'ProductX',
    description: 'Phone device',
    descriptionSource: 'manual',
  },
  {
    id: 'ref-3',
    url: 'https://example.com/room.png',
    type: 'environment',
    name: 'Room',
    description: 'Bedroom environment',
    descriptionSource: 'manual',
  },
];

describe('scene references', () => {
  it('extracts entity tags from description and explicit scene tags', () => {
    const tags = getSceneEntityTags({
      description: 'Shot on <Alice> with <ProductX> in hand',
      charactersUsed: ['<ALICE>'],
      productsUsed: ['ProductX'],
    });

    expect(tags.has('<alice>')).toBe(true);
    expect(tags.has('<productx>')).toBe(true);
  });

  it('returns matched references when scene mentions specific tags', () => {
    const matched = getSceneRelevantReferences(
      {
        description: 'Close-up on <Alice> only',
        charactersUsed: [],
        productsUsed: [],
      },
      references
    );

    expect(matched).toHaveLength(1);
    expect(matched[0]?.name).toBe('Alice');
  });

  it('falls back to all references when scene has no tags', () => {
    const matched = getSceneRelevantReferences(
      {
        description: 'Wide establishing shot',
        charactersUsed: [],
        productsUsed: [],
      },
      references
    );

    expect(matched).toHaveLength(references.length);
  });
});
