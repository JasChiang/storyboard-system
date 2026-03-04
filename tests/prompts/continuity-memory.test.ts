import { describe, expect, it } from 'vitest';
import { buildContinuityMemoryLines } from '@/lib/prompts/continuity-memory';

describe('continuity memory lines', () => {
  it('returns continuity summary from previous shots', () => {
    const lines = buildContinuityMemoryLines(
      { id: 's3', sceneNumber: 3 },
      [
        {
          id: 's1',
          sceneNumber: 1,
          continuityAnchor: '手機握持角度固定',
          continuityLock: 'logo 與材質不變',
          changeFromPrev: 'N/A',
          requiredReferences: ['<Alice>', '<ProductX>'],
        },
        {
          id: 's2',
          sceneNumber: 2,
          continuityAnchor: '產品仍在畫面右側',
          continuityLock: '',
          changeFromPrev: '景別由中景推到近景',
          requiredReferences: ['<ProductX>'],
        },
        {
          id: 's3',
          sceneNumber: 3,
          continuityAnchor: '',
          continuityLock: '',
          changeFromPrev: '',
          requiredReferences: [],
        },
      ]
    );

    expect(lines[0]).toContain('Continuity memory');
    expect(lines.some((line) => line.includes('Shot 1'))).toBe(true);
    expect(lines.some((line) => line.includes('Shot 2'))).toBe(true);
  });

  it('returns empty when no previous scene exists', () => {
    const lines = buildContinuityMemoryLines(
      { id: 's1', sceneNumber: 1 },
      [{ id: 's1', sceneNumber: 1, continuityAnchor: '', continuityLock: '', changeFromPrev: 'N/A', requiredReferences: [] }]
    );

    expect(lines).toEqual([]);
  });
});
