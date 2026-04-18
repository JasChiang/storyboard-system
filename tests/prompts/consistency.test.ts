import { describe, expect, it } from 'vitest';
import {
  buildNegativePromptGuards,
  buildIdentityBibleLines,
  buildVideoPromptStructured,
  describeReferenceHealth,
  DEFAULT_CONSISTENCY_NEGATIVES,
  DEFAULT_PRODUCT_NEGATIVES,
  STATIC_FRAME_NEGATIVES,
} from '@/lib/prompts/consistency';
import type { ProjectReference } from '@/lib/types/storyboard';

const character: ProjectReference = {
  id: 'c1',
  url: 'u1',
  type: 'character',
  name: 'Alice',
  description: 'Young woman with short brown hair and freckles',
  descriptionSource: 'manual',
  identityCore: 'Young woman, freckles, short brown bob',
};

const product: ProjectReference = {
  id: 'p1',
  url: 'u2',
  type: 'product',
  name: 'PhoneX',
  description: 'A sleek black smartphone',
  descriptionSource: 'manual',
  identityCore: 'Black matte aluminum phone',
};

describe('buildNegativePromptGuards', () => {
  it('adds character-drift negatives when character ref is present', () => {
    const out = buildNegativePromptGuards([character]);
    expect(out).toContain('different face');
    expect(out).toContain('outfit change');
  });

  it('adds product-drift negatives when product ref is present', () => {
    const out = buildNegativePromptGuards([product]);
    expect(out).toContain('different proportions');
    expect(out).toContain('relocated buttons');
  });

  it('merges user negatives first and dedupes case-insensitively', () => {
    const out = buildNegativePromptGuards([character], {
      userNegatives: 'Different Face, cartoon style',
    });
    expect(out.split(',')[0]?.trim().toLowerCase()).toBe('different face');
    // "different face" should appear exactly once
    const occurrences = out.toLowerCase().split('different face').length - 1;
    expect(occurrences).toBe(1);
    expect(out).toContain('cartoon style');
  });

  it('includes static-frame negatives when requested', () => {
    const out = buildNegativePromptGuards([character], { includeStaticFrame: true });
    expect(out).toContain('motion blur');
    expect(out).toContain('split screen');
  });

  it('caps total tokens at maxTokens', () => {
    const out = buildNegativePromptGuards([character, product], {
      includeStaticFrame: true,
      maxTokens: 5,
    });
    const count = out.split(',').filter(Boolean).length;
    expect(count).toBe(5);
  });

  it('returns empty string when no refs and no user negatives', () => {
    expect(buildNegativePromptGuards([])).toBe('');
  });

  it('constants expose expected token sets', () => {
    expect(DEFAULT_CONSISTENCY_NEGATIVES.length).toBeGreaterThan(0);
    expect(DEFAULT_PRODUCT_NEGATIVES.length).toBeGreaterThan(0);
    expect(STATIC_FRAME_NEGATIVES.length).toBeGreaterThan(0);
  });
});

describe('buildIdentityBibleLines', () => {
  it('emits one tagged line per entity using identityCore first', () => {
    const lines = buildIdentityBibleLines([character, product]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('<Alice>: Young woman, freckles, short brown bob');
    expect(lines[1]).toBe('<PhoneX>: Black matte aluminum phone');
  });

  it('skips refs without identity text', () => {
    const bare: ProjectReference = {
      id: 'x', url: 'u', type: 'character', name: 'Ghost', description: '', descriptionSource: 'manual',
    };
    expect(buildIdentityBibleLines([bare])).toEqual([]);
  });

  it('trims lines to 160 chars with ellipsis', () => {
    const long: ProjectReference = {
      ...character,
      id: 'long',
      identityCore: 'x'.repeat(500),
    };
    const [line] = buildIdentityBibleLines([long]);
    expect(line!.length).toBeLessThanOrEqual(170); // tag + 160 + ellipsis
    expect(line).toMatch(/…$/);
  });
});

describe('buildVideoPromptStructured', () => {
  it('assembles Subject/Action/Context/Style in order', () => {
    const p = buildVideoPromptStructured({
      subject: 'Alice',
      action: 'walks toward the door',
      context: 'cafe interior at dusk',
      style: 'warm cinematic lighting',
    });
    expect(p).toBe('Subject: Alice. Action: walks toward the door. Context: cafe interior at dusk. Style: warm cinematic lighting');
  });

  it('omits empty slots', () => {
    const p = buildVideoPromptStructured({ subject: 'A', action: 'B' });
    expect(p).toBe('Subject: A. Action: B');
  });

  it('appends negatives on a new line when provided', () => {
    const p = buildVideoPromptStructured({ subject: 'A', action: 'B', negatives: 'flicker' });
    expect(p).toContain('\nNegative: flicker');
  });
});

describe('describeReferenceHealth', () => {
  it('reports insufficient when count is 0', () => {
    expect(describeReferenceHealth([], 'character').level).toBe('insufficient');
  });

  it('reports basic for 1-2 refs', () => {
    expect(describeReferenceHealth([character], 'character').level).toBe('basic');
  });

  it('reports good for 3-5 refs', () => {
    const refs = Array.from({ length: 4 }, (_, i) => ({ ...character, id: `c${i}` }));
    expect(describeReferenceHealth(refs, 'character').level).toBe('good');
  });

  it('reports excellent for >=6 refs', () => {
    const refs = Array.from({ length: 6 }, (_, i) => ({ ...character, id: `c${i}` }));
    expect(describeReferenceHealth(refs, 'character').level).toBe('excellent');
  });

  it('filters by requested type', () => {
    const mixed = [character, product, product];
    expect(describeReferenceHealth(mixed, 'product').count).toBe(2);
    expect(describeReferenceHealth(mixed, 'character').count).toBe(1);
  });
});
