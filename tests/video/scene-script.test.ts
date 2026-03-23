import { describe, expect, it } from 'vitest';
import { buildVideoSceneScriptLines } from '@/lib/video/adapters/scene-script';

describe('video scene script lines', () => {
  it('outputs only motion, intent, and continuity — no static visual description', () => {
    const lines = buildVideoSceneScriptLines({
      subjectMotion: '人物微動，商品固定',
      sceneIntent: '建立產品信任感',
      continuityLock: 'logo、比例、材質鎖定',
    });

    // Should include subject motion (the action)
    expect(lines.some((line) => line.includes('人物微動'))).toBe(true);

    // Should include scene intent as goal
    expect(lines.some((line) => line.includes('Scene goal:'))).toBe(true);

    // Should include continuity lock
    expect(lines.some((line) => line.includes('Keep unchanged:'))).toBe(true);

    // Should NOT include any static visual description labels
    expect(lines.some((line) => line.startsWith('Storyboard visual description:'))).toBe(false);
    expect(lines.some((line) => line.startsWith('Start composition anchor:'))).toBe(false);
    expect(lines.some((line) => line.startsWith('Shot view intent:'))).toBe(false);
    expect(lines.some((line) => line.startsWith('Characters used:'))).toBe(false);
    expect(lines.some((line) => line.startsWith('Products used:'))).toBe(false);
  });

  it('returns empty array when no motion or intent fields are set', () => {
    const lines = buildVideoSceneScriptLines({
      subjectMotion: undefined,
      sceneIntent: undefined,
      continuityLock: undefined,
    });

    expect(lines).toHaveLength(0);
  });
});
