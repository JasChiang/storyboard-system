import { describe, expect, it } from 'vitest';
import { buildPrioritizedReferenceUrls } from '@/lib/references/reference-priority';
import type { ProjectReference } from '@/lib/types/storyboard';

const mkRef = (id: string, url: string): ProjectReference => ({
  id,
  url,
  type: 'character',
  name: id,
  description: id,
  descriptionSource: 'manual',
});

describe('reference priority', () => {
  it('keeps continuity first, then required content, then optional, then style', () => {
    const requiredRefs = [mkRef('req-1', 'https://example.com/req-1.png')];
    const optionalRefs = [mkRef('opt-1', 'https://example.com/opt-1.png')];

    const urls = buildPrioritizedReferenceUrls({
      model: 'seedream-5-lite',
      continuityReferenceUrl: 'https://example.com/continuity.png',
      startFrameReferenceUrl: 'https://example.com/start.png',
      sceneReferenceUrl: 'https://example.com/scene.png',
      requiredContentRefs: requiredRefs,
      optionalContentRefs: optionalRefs,
      styleReferenceUrls: ['https://example.com/style.png'],
    });

    expect(urls).toEqual([
      'https://example.com/continuity.png',
      'https://example.com/start.png',
      'https://example.com/scene.png',
      'https://example.com/req-1.png',
    ]);
  });

  it('deduplicates urls while preserving first occurrence', () => {
    const duplicate = 'https://example.com/shared.png';
    const urls = buildPrioritizedReferenceUrls({
      model: 'nano-banana-pro',
      continuityReferenceUrl: duplicate,
      startFrameReferenceUrl: duplicate,
      sceneReferenceUrl: duplicate,
      requiredContentRefs: [mkRef('req', duplicate)],
      optionalContentRefs: [mkRef('opt', duplicate)],
      styleReferenceUrls: [duplicate],
    });

    expect(urls).toEqual([duplicate]);
  });

  it('can prioritize content refs for start-frame generation', () => {
    const requiredRefs = [mkRef('req-1', 'https://example.com/req-1.png')];
    const optionalRefs = [mkRef('opt-1', 'https://example.com/opt-1.png')];
    const urls = buildPrioritizedReferenceUrls({
      model: 'nano-banana-pro',
      continuityReferenceUrl: 'https://example.com/continuity.png',
      sceneReferenceUrl: 'https://example.com/scene.png',
      requiredContentRefs: requiredRefs,
      optionalContentRefs: optionalRefs,
      prioritizeContentRefs: true,
    });

    expect(urls.slice(0, 3)).toEqual([
      'https://example.com/req-1.png',
      'https://example.com/scene.png',
      'https://example.com/opt-1.png',
    ]);
  });

  it('can keep only required refs when strictRequiredOnlyWhenPresent is enabled', () => {
    const urls = buildPrioritizedReferenceUrls({
      model: 'nano-banana-pro',
      requiredContentRefs: [mkRef('req-1', 'https://example.com/req-1.png')],
      optionalContentRefs: [mkRef('opt-1', 'https://example.com/opt-1.png')],
      strictRequiredOnlyWhenPresent: true,
    });

    expect(urls).toEqual(['https://example.com/req-1.png']);
  });

  it('can disable style images in image_urls payload', () => {
    const urls = buildPrioritizedReferenceUrls({
      model: 'nano-banana-pro',
      styleReferenceUrls: ['https://example.com/style.png'],
      includeStyleReferenceImages: false,
    });

    expect(urls).toEqual([]);
  });

  it('guarantees the start frame survives the cap for image_end even when identity_first is selected', () => {
    const urls = buildPrioritizedReferenceUrls({
      model: 'nano-banana-pro',
      stage: 'image_end',
      priorityMode: 'identity_first',
      startFrameReferenceUrl: 'https://example.com/start.png',
      requiredContentRefs: [
        mkRef('req-1', 'https://example.com/req-1.png'),
        mkRef('req-2', 'https://example.com/req-2.png'),
        mkRef('req-3', 'https://example.com/req-3.png'),
      ],
      optionalContentRefs: [
        mkRef('opt-1', 'https://example.com/opt-1.png'),
        mkRef('opt-2', 'https://example.com/opt-2.png'),
        mkRef('opt-3', 'https://example.com/opt-3.png'),
      ],
    });

    expect(urls).toHaveLength(7);
    expect(urls).toContain('https://example.com/start.png');
  });

  it('guarantees continuity references survive the cap for video prompts', () => {
    const urls = buildPrioritizedReferenceUrls({
      model: 'nano-banana-pro',
      stage: 'video',
      priorityMode: 'identity_first',
      continuityReferenceUrl: 'https://example.com/prev-end.png',
      startFrameReferenceUrl: 'https://example.com/start.png',
      requiredContentRefs: [
        mkRef('req-1', 'https://example.com/req-1.png'),
        mkRef('req-2', 'https://example.com/req-2.png'),
        mkRef('req-3', 'https://example.com/req-3.png'),
        mkRef('req-4', 'https://example.com/req-4.png'),
      ],
      optionalContentRefs: [
        mkRef('opt-1', 'https://example.com/opt-1.png'),
        mkRef('opt-2', 'https://example.com/opt-2.png'),
      ],
    });

    expect(urls).toHaveLength(8);
    expect(urls).toContain('https://example.com/prev-end.png');
    expect(urls).toContain('https://example.com/start.png');
  });
});
