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
    continuityLock: 'Keep product and room geometry unchanged',
    changeFromPrev: 'N/A',
    charactersUsed: ['<Alice>'],
    productsUsed: ['<ProductX>'],
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

  it('flags continuation scene without end frame as blocked', () => {
    const result = validateStoryboard(
      buildStoryboard({
        requiresEndFrame: false,
        endFrameDelta: '',
        transitionToNext: {
          type: 'continuation',
          reason: 'Need seamless carry-over',
          useEndFrameAsNextStart: true,
        },
      })
    );

    expect(result.issues.some((issue) => issue.code === 'continuation_without_endframe')).toBe(true);
    expect(result.sceneReports[0]?.status).toBe('block');
  });

  it('marks scene as warn when entity tags are missing', () => {
    const result = validateStoryboard(
      buildStoryboard({
        charactersUsed: [],
        productsUsed: [],
      })
    );

    expect(result.issues.some((issue) => issue.code === 'missing_entity_tags')).toBe(true);
    expect(result.sceneReports[0]?.status).toBe('warn');
  });
});
