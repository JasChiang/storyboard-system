import { describe, expect, it } from 'vitest';
import { getSceneGenerationBlockers } from '@/lib/workflow/generation-guard';

describe('generation guard', () => {
  it('blocks generation when scene is QA blocked', () => {
    const blockers = getSceneGenerationBlockers({
      stage: 'image_start',
      scene: {
        qaStatus: 'block',
        qaIssues: ['high risk'],
        requiredReferences: [],
      },
      projectReferences: [],
    });

    expect(blockers.some((blocker) => blocker.code === 'qa_blocked')).toBe(true);
  });

  it('blocks when requiredReferences are missing from project references', () => {
    const blockers = getSceneGenerationBlockers({
      stage: 'image_start',
      scene: {
        qaStatus: 'pass',
        qaIssues: [],
        requiredReferences: ['<Alice>', '<ProductX>'],
      },
      projectReferences: [
        { name: 'Alice', type: 'character' },
      ],
    });

    expect(blockers.some((blocker) => blocker.code === 'required_references_not_found')).toBe(true);
  });

  it('blocks video generation without start frame', () => {
    const blockers = getSceneGenerationBlockers({
      stage: 'video',
      scene: {
        qaStatus: 'pass',
        qaIssues: [],
        requiredReferences: [],
      },
      projectReferences: [],
      effectiveStartFrameUrl: '',
    });

    expect(blockers.some((blocker) => blocker.code === 'missing_start_frame')).toBe(true);
  });

  it('allows pending start frame for image_end when batch will create start first', () => {
    const blockers = getSceneGenerationBlockers({
      stage: 'image_end',
      scene: {
        qaStatus: 'pass',
        qaIssues: [],
        requiredReferences: [],
      },
      projectReferences: [],
      effectiveStartFrameUrl: '',
      allowPendingStartFrame: true,
    });

    expect(blockers.some((blocker) => blocker.code === 'missing_start_frame')).toBe(false);
  });

  it('does not block when referencePlan requests a view angle not uploaded', () => {
    const blockers = getSceneGenerationBlockers({
      stage: 'image_start',
      scene: {
        qaStatus: 'pass',
        qaIssues: [],
        requiredReferences: [],
      },
      projectReferences: [
        { name: 'Alice', type: 'character' },
      ],
    });

    // Missing view angles should not block — the model can infer from available refs
    expect(blockers.some((blocker) => blocker.code === 'reference_plan_view_not_found')).toBe(false);
  });
});
