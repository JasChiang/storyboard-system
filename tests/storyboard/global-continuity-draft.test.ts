import { describe, expect, it } from 'vitest';
import type { Storyboard } from '@/lib/types/storyboard';
import { applyAutoGlobalContinuityDraft, buildGlobalContinuityDraft } from '@/lib/storyboard/global-continuity-draft';

const references = [
  {
    id: 'char-1',
    url: 'https://example.com/char.jpg',
    description: 'Hero character',
    type: 'character' as const,
    name: 'Alice',
    descriptionSource: 'ai' as const,
    identityCore: 'short bob haircut, red jacket, silver earrings',
    mustKeepFeatures: ['red jacket silhouette', 'silver earrings'],
    guidelines: 'Face shape cannot drift；outfit palette stays red/black',
    ipProfile: {
      profileVersion: 1,
      strictIdentity: true,
      allowAccessoryChanges: false,
      textLogoPolicy: 'forbid_new_text' as const,
      immutableRules: ['facial proportions stay consistent'],
    },
  },
  {
    id: 'prod-1',
    url: 'https://example.com/product.jpg',
    description: 'Phone product',
    type: 'product' as const,
    name: 'Nova X1',
    descriptionSource: 'ai' as const,
    identityCore: 'rounded corners, triple camera triangle layout',
    mustKeepFeatures: ['logo position on lower back', 'matte graphite finish'],
    guidelines: 'Buttons and ports layout cannot move',
    ipProfile: {
      profileVersion: 1,
      strictIdentity: true,
      allowAccessoryChanges: true,
      textLogoPolicy: 'lock_visible_text' as const,
    },
  },
  {
    id: 'style-1',
    url: 'https://example.com/style.jpg',
    description: 'Style frame',
    type: 'style' as const,
    name: 'Launch Film',
    descriptionSource: 'ai' as const,
    styleTraits: 'clean highlight rolloff, premium blue-gray palette',
    guidelines: 'No gritty texture',
  },
];

function baseStoryboard(): Storyboard {
  return {
    id: 'sb-1',
    projectId: 'p-1',
    title: 'Demo',
    originalPrompt: 'demo',
    templateUsed: 'commercial',
    scenes: [],
    projectReferences: references,
    sharedAnchors: [],
    sharedContinuityDirectives: [],
    createdAt: '2026-03-18T00:00:00.000Z',
    updatedAt: '2026-03-18T00:00:00.000Z',
  };
}

describe('global continuity draft builder', () => {
  it('derives anchors and directives from project references and style continuity strategy', () => {
    const draft = buildGlobalContinuityDraft(references, {
      id: 'preset-lifestyle-commercial',
      name: '生活情境商業風',
      continuityStrategy: 'Keep world layout and wardrobe logic stable.',
    });

    expect(draft.sharedAnchors).toContain('Alice identity stays locked across shots');
    expect(draft.sharedAnchors).toContain('Nova X1 identity stays locked across shots');
    expect(draft.sharedAnchors).toContain('Launch Film visual language stays consistent across the full storyboard');
    expect(draft.sharedContinuityDirectives.some((item) => item.directive.includes('core identity'))).toBe(true);
    expect(draft.sharedContinuityDirectives.some((item) => item.directive.includes('visible logo / text must remain legible'))).toBe(true);
    expect(draft.sharedContinuityDirectives.some((item) => item.anchorLabel.startsWith('style-profile:'))).toBe(true);
  });

  it('applies draft automatically when storyboard continuity fields are empty', () => {
    const draft = buildGlobalContinuityDraft(references);
    const next = applyAutoGlobalContinuityDraft(baseStoryboard(), draft);

    expect(next.sharedAnchors).toEqual(draft.sharedAnchors);
    expect(next.sharedContinuityDirectives).toEqual(draft.sharedContinuityDirectives);
    expect(next.globalContinuityDraft?.sourceSignature).toBe(draft.sourceSignature);
  });

  it('does not overwrite manually edited continuity fields when source changes', () => {
    const originalDraft = buildGlobalContinuityDraft(references);
    const storyboardWithManualEdits: Storyboard = {
      ...applyAutoGlobalContinuityDraft(baseStoryboard(), originalDraft),
      sharedAnchors: ['custom anchor from editor'],
      sharedContinuityDirectives: [{ anchorLabel: 'manual', directive: 'keep custom wording' }],
    };

    const refreshedDraft = buildGlobalContinuityDraft([
      ...references,
      {
        id: 'env-1',
        url: 'https://example.com/env.jpg',
        description: 'Store interior',
        type: 'environment' as const,
        name: 'Flagship Store',
        descriptionSource: 'ai' as const,
        identityCore: 'backlit shelf wall and center table axis',
      },
    ]);

    const next = applyAutoGlobalContinuityDraft(storyboardWithManualEdits, refreshedDraft);

    expect(next.sharedAnchors).toEqual(['custom anchor from editor']);
    expect(next.sharedContinuityDirectives).toEqual([{ anchorLabel: 'manual', directive: 'keep custom wording' }]);
    expect(next.globalContinuityDraft?.sourceSignature).toBe(refreshedDraft.sourceSignature);
  });
});
