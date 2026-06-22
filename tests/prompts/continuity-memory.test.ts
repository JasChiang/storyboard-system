import { describe, expect, it } from 'vitest';
import { buildContinuityMemoryLines } from '@/lib/prompts/continuity-memory';

describe('continuity memory lines', () => {
  it('returns continuity summary only for an unbroken continuation chain', () => {
    const lines = buildContinuityMemoryLines(
      { id: 's3', sceneNumber: 3 },
      [
        {
          id: 's1',
          sceneNumber: 1,
          continuityAnchor: '手機握持角度固定',
          continuityLock: 'logo 與材質不變',
          requiredReferences: ['<Alice>', '<ProductX>'],
          transitionToNext: { type: 'continuation' },
        },
        {
          id: 's2',
          sceneNumber: 2,
          continuityAnchor: '產品仍在畫面右側',
          continuityLock: '',
          requiredReferences: ['<ProductX>'],
          transitionToNext: { type: 'continuation' },
        },
        {
          id: 's3',
          sceneNumber: 3,
          continuityAnchor: '',
          continuityLock: '',
          requiredReferences: [],
          transitionToNext: { type: 'cut' },
        },
      ]
    );

    expect(lines[0]).toContain('Continuity memory');
    expect(lines.some((line) => line.includes('Shot 1'))).toBe(true);
    expect(lines.some((line) => line.includes('Shot 2'))).toBe(true);
  });

  it('drops previous-shot memory across cut transitions and never replays changeFromPrev deltas', () => {
    const lines = buildContinuityMemoryLines(
      { id: 's3', sceneNumber: 3 },
      [
        {
          id: 's1',
          sceneNumber: 1,
          continuityAnchor: '臥室空間',
          continuityLock: '主角髮型不變',
          requiredReferences: ['<Alice>'],
          transitionToNext: { type: 'cut' },
        },
        {
          id: 's2',
          sceneNumber: 2,
          continuityAnchor: '更衣間空間',
          continuityLock: '衣櫥鏡面質感',
          requiredReferences: ['<Closet>'],
          transitionToNext: { type: 'cut' },
        },
        {
          id: 's3',
          sceneNumber: 3,
          continuityAnchor: '廚房空間',
          continuityLock: '冰箱霧面黑面板',
          requiredReferences: ['<Fridge>'],
          transitionToNext: { type: 'continuation' },
        },
      ]
    );

    expect(lines).toEqual([]);
  });

  it('returns empty when no previous scene exists', () => {
    const lines = buildContinuityMemoryLines(
      { id: 's1', sceneNumber: 1 },
      [{ id: 's1', sceneNumber: 1, continuityAnchor: '', continuityLock: '', requiredReferences: [], transitionToNext: { type: 'cut' } }]
    );

    expect(lines).toEqual([]);
  });
});
