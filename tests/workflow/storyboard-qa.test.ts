import { describe, expect, it } from 'vitest';
import { validateStoryboard } from '@/lib/workflow/storyboard-qa';
import type { Scene, Storyboard } from '@/lib/types/storyboard';

function buildScene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 'scene-1',
    sceneNumber: 1,
    description: 'Character enters the room and looks at the product.',
    cameraMovement: 'Slow pan right',
    dialogue: '',
    duration: 5,
    sceneIntent: 'Introduce product in context',
    startComposition: 'Character on left, product on table',
    subjectMotion: 'Character walks slowly, product remains stable on table',
    continuityLock: 'Keep product and room geometry unchanged',
    shotIntent: 'Shift attention from character to product detail',
    continuityAnchor: 'Product remains on the same table position',
    renderLane: 'hero',
    productionRisk: 'medium',
    reservedForPost: '',
    deliveryIntent: 'demo',
    referencePriorityMode: 'stage_balanced',
    changeFromPrev: 'N/A',
    charactersUsed: ['<Alice>'],
    productsUsed: ['<ProductX>'],
    requiredReferences: ['<Alice>', '<ProductX>'],
    requiresEndFrame: true,
    endFrameDelta: 'Camera lands on the product close-up.',
    transitionToNext: {
      type: 'dissolve',
      reason: 'Smooth emotional continuity',
      useEndFrameAsNextStart: false,
    },
    ...overrides,
  };
}

function buildStoryboard(sceneOverrides: Partial<Scene> = {}): Storyboard {
  return {
    id: 'storyboard-1',
    projectId: 'project-1',
    title: 'QA Test',
    originalPrompt: 'Generate a short product storyboard',
    templateUsed: 'default',
    scenes: [buildScene(sceneOverrides)],
    sharedAnchors: ['Product silhouette stays stable'],
    sharedContinuityDirectives: [{ anchorLabel: 'logo', directive: 'Keep logo spelling unchanged' }],
    projectReferences: [
      {
        id: 'ref-alice',
        url: 'https://example.com/alice.png',
        type: 'character',
        name: 'Alice',
        description: 'Alice reference',
        descriptionSource: 'manual',
      },
      {
        id: 'ref-product-x',
        url: 'https://example.com/productx.png',
        type: 'product',
        name: 'ProductX',
        description: 'ProductX reference',
        descriptionSource: 'manual',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('storyboard QA', () => {
  it('passes high-risk checks for a valid scene', () => {
    const result = validateStoryboard(buildStoryboard());
    const highIssues = result.issues.filter((issue) => issue.severity === 'high');

    expect(highIssues).toHaveLength(0);
    expect(result.sceneReports[0]?.status).toBe('pass');
  });

  it('flags continuation scene without end frame as warn (not blocked)', () => {
    const result = validateStoryboard(
      buildStoryboard({
        requiresEndFrame: false,
        endFrameDelta: '',
        requiredReferences: ['<Alice>'],
        transitionToNext: {
          type: 'continuation',
          reason: 'Need seamless carry-over',
          useEndFrameAsNextStart: true,
        },
      })
    );

    expect(result.issues.some((issue) => issue.code === 'continuation_without_endframe')).toBe(true);
    expect(result.sceneReports[0]?.status).toBe('warn');
  });

  it('does not warn continuation_without_endframe when source mode is previous_start_only', () => {
    const result = validateStoryboard(
      buildStoryboard({
        requiresEndFrame: false,
        endFrameDelta: '',
        transitionToNext: {
          type: 'continuation',
          reason: 'Keep continuity from previous start frame only',
          useEndFrameAsNextStart: true,
          continuitySourceMode: 'previous_start_only',
        },
      })
    );

    expect(result.issues.some((issue) => issue.code === 'continuation_without_endframe')).toBe(false);
    expect(result.sceneReports[0]?.status).toBe('pass');
  });

  it('marks scene as warn when entity tags are missing', () => {
    const result = validateStoryboard(
      buildStoryboard({
        charactersUsed: [],
        productsUsed: [],
        requiredReferences: [],
      })
    );

    expect(result.issues.some((issue) => issue.code === 'missing_entity_tags')).toBe(true);
    expect(result.sceneReports[0]?.status).toBe('warn');
  });

  it('flags new production contract fields when missing', () => {
    const result = validateStoryboard(
      buildStoryboard({
        renderLane: undefined,
        productionRisk: undefined,
        reservedForPost: undefined,
        deliveryIntent: undefined,
        referencePriorityMode: undefined,
      })
    );

    expect(result.issues.some((issue) => issue.code === 'missing_render_lane')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'missing_production_risk')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'missing_reserved_for_post')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'missing_delivery_intent')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'missing_reference_priority_mode')).toBe(true);
    expect(result.sceneReports[0]?.status).toBe('warn');
  });

  it('flags high risk when requiredReferences do not exist in project references', () => {
    const result = validateStoryboard(
      buildStoryboard({
        requiredReferences: ['<MissingTag>'],
      })
    );

    expect(result.issues.some((issue) => issue.code === 'required_references_not_found')).toBe(true);
    expect(result.sceneReports[0]?.status).toBe('block');
  });
});
