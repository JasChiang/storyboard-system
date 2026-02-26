import { describe, expect, it } from 'vitest';
import { buildVideoSceneScriptLines } from '@/lib/video/adapters/scene-script';

describe('video scene script lines', () => {
  it('includes structured storyboard fields', () => {
    const lines = buildVideoSceneScriptLines({
      description: '角色拿著產品看向鏡頭',
      sceneIntent: '建立產品信任感',
      startComposition: '中景，商品在畫面中央',
      subjectMotion: '人物微動，商品固定',
      continuityLock: 'logo、比例、材質鎖定',
      shotIntent: '強調產品質感',
      continuityAnchor: '手機握持角度',
      changeFromPrev: '景別更近',
    });

    expect(lines.some((line) => line.startsWith('Storyboard visual description:'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Scene intent:'))).toBe(true);
    expect(lines.some((line) => line.startsWith('Continuity lock:'))).toBe(true);
  });
});

