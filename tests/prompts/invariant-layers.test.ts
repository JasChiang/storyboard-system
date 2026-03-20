import { describe, expect, it } from 'vitest';
import {
  buildImageIdentityConstraintLines,
  buildImageReferenceConstraintLines,
  buildVideoIdentityInvariantLines,
} from '@/lib/prompts/invariant-layers';

describe('invariant prompt layers', () => {
  it('builds concise image reference constraints', () => {
    const lines = buildImageReferenceConstraintLines({
      hasReferenceInputs: true,
      viewIntent: 'side',
      primaryRefs: [
        {
          id: 'char-side',
          type: 'character',
          name: 'Alice',
          angle: 'side',
          description: '側臉輪廓與髮線',
          descriptionSource: 'manual',
          url: 'https://example.com/alice-side.png',
        },
      ],
      secondaryRefs: [
        {
          id: 'char-front',
          type: 'character',
          name: 'Alice',
          angle: 'front',
          description: '正面五官',
          descriptionSource: 'manual',
          url: 'https://example.com/alice-front.png',
        },
      ],
      lockedRefs: [
        {
          id: 'char-side',
          type: 'character',
          name: 'Alice',
          angle: 'side',
          description: '側臉輪廓與髮線',
          descriptionSource: 'manual',
          url: 'https://example.com/alice-side.png',
        },
      ],
    });

    expect(lines.some((line) => line.includes('locked references > shot composition > style treatment'))).toBe(true);
    expect(lines.some((line) => line.includes('Match the resolved shot view intent: side'))).toBe(true);
    expect(lines.some((line) => line.includes('Primary reference views for this shot'))).toBe(true);
  });

  it('builds shared image identity constraints without duplicated text policy lines', () => {
    const lines = buildImageIdentityConstraintLines([
      {
        id: 'phone-1',
        type: 'product',
        name: 'PhoneX',
        description: 'matte black phone',
        descriptionSource: 'manual',
        url: 'https://example.com/phone.png',
        ipProfile: {
          profileVersion: 1,
          strictIdentity: true,
          allowAccessoryChanges: false,
          textLogoPolicy: 'forbid_new_text',
        },
      },
    ]);

    expect(lines.some((line) => line.includes('Keep product identity unchanged'))).toBe(true);
    expect(lines.filter((line) => line.includes('package text')).length).toBe(1);
  });

  it('builds shared video identity invariants', () => {
    const lines = buildVideoIdentityInvariantLines([
      {
        id: 'phone-1',
        type: 'product',
        name: 'PhoneX',
        description: 'matte black phone',
        descriptionSource: 'manual',
        url: 'https://example.com/phone.png',
        identityCore: '方正外框與黑色鏡頭模組',
        mustKeepFeatures: ['黑色鏡頭模組', '背板 Logo'],
        ipProfile: {
          profileVersion: 1,
          strictIdentity: true,
          allowAccessoryChanges: false,
          textLogoPolicy: 'lock_visible_text',
        },
      },
    ]);

    expect(lines.some((line) => line.startsWith('Keep identity cores fixed:'))).toBe(true);
    expect(lines.some((line) => line.includes('Preserve required visible features/material cues'))).toBe(true);
    expect(lines.filter((line) => line.includes('exact spelling')).length).toBe(1);
  });
});
