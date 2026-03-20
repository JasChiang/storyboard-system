import { describe, expect, it } from 'vitest';
import { buildSceneDirectiveLines } from '@/lib/prompts/scene-directives';

describe('scene directives', () => {
  it('builds directives from structured scene fields', () => {
    const lines = buildSceneDirectiveLines({
      cameraMovement: 'dolly in',
      sceneIntent: '強化品牌高級感',
      startComposition: '商品置中，人物在右側',
      subjectMotion: '人物微動，商品固定',
      continuityLock: 'Logo、材質、幾何不可變',
      shotIntent: '帶出賣點',
      continuityAnchor: '手機握持角度',
      viewIntent: 'three_quarter',
      referenceViewHints: {
        '<Alice>': 'front',
        '<PhoneX>': 'back',
      },
      referencePlan: [
        { tag: '<Alice>', entityType: 'character', requestedView: 'front', required: false },
        { tag: '<PhoneX>', entityType: 'product', requestedView: 'back', required: true, visibleFeatures: '鏡頭模組與背板 Logo' },
      ],
      requiredReferences: ['<PhoneX>'],
      charactersUsed: ['<Alice>'],
      productsUsed: ['<PhoneX>'],
    });

    expect(lines[0]).toBe('Scene directives:');
    expect(lines.some((line) => line.startsWith('Scene intent:'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Camera framing intent:'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Continuity lock:'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Shot view intent: three_quarter'))).toBe(true);
    expect(lines.some((line) => line.includes('<PhoneX> => back'))).toBe(true);
    expect(lines.some((line) => line.includes('<PhoneX> product -> back required visible: 鏡頭模組與背板 Logo'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Required references: <PhoneX>'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Change from previous shot:'))).toBe(false);
  });

  it('returns empty list when no directives available', () => {
    const lines = buildSceneDirectiveLines({
      cameraMovement: '',
      sceneIntent: '',
      startComposition: '',
      subjectMotion: '',
      continuityLock: '',
      shotIntent: '',
      continuityAnchor: '',
      viewIntent: undefined,
      referenceViewHints: undefined,
      referencePlan: [],
      requiredReferences: [],
      charactersUsed: [],
      productsUsed: [],
    });

    expect(lines).toEqual([]);
  });
});
