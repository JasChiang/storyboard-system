import { describe, expect, it } from 'vitest';
import { buildImageGenerationPrompt, type ImagePromptInput } from '@/lib/prompts/image-prompt';
import type { ProjectReference, StyleProfile } from '@/lib/types/storyboard';

const productRef: ProjectReference = {
  id: 'ref-product',
  url: 'https://example.com/phone.png',
  type: 'product',
  name: 'PhoneX',
  description: 'A sleek black smartphone with rounded aluminum frame',
  descriptionSource: 'manual',
  mustKeepFeatures: ['triple camera cluster', 'USB-C port', 'matte finish'],
  ipProfile: {
    profileVersion: 1,
    textLogoPolicy: 'lock_visible_text',
    strictIdentity: true,
    allowAccessoryChanges: false,
  },
};

const characterRef: ProjectReference = {
  id: 'ref-char',
  url: 'https://example.com/alice.png',
  type: 'character',
  name: 'Alice',
  description: 'Young woman with short brown hair and freckles',
  descriptionSource: 'manual',
  mustKeepFeatures: ['freckles', 'short brown bob'],
};

const styleRef: ProjectReference = {
  id: 'ref-style',
  url: 'https://example.com/style.png',
  type: 'style',
  name: 'CinematicWarm',
  description: 'Cinematic warm color grading with soft diffusion',
  descriptionSource: 'manual',
};

const styleProfile: StyleProfile = {
  id: 'style-1',
  name: 'Cinematic',
  stylePrompt: 'Cinematic product photography, warm golden-hour lighting, shallow depth of field',
  negativePrompt: 'blurry; watermark; oversaturated; CGI',
};

function makeInput(overrides: Partial<ImagePromptInput> = {}): ImagePromptInput {
  return {
    scene: {
      description: 'Alice holds PhoneX up to the camera on a white desk with a potted succulent.',
      cameraMovement: 'medium close-up',
      sceneIntent: 'showcase product',
      startComposition: 'subject centered',
      viewIntent: 'front',
      shotIntent: 'highlight product texture',
      endFrameDescription: undefined,
      endFrameDelta: undefined,
      endFrameDeltaSpec: undefined,
    },
    isEndFrame: false,
    hasStartFrame: false,
    contentRefs: [productRef, characterRef],
    styleRefs: [],
    styleProfile,
    ...overrides,
  };
}

describe('buildImageGenerationPrompt', () => {
  it('produces a natural-language prompt with all sections', () => {
    const prompt = buildImageGenerationPrompt(makeInput());

    // Should contain scene description
    expect(prompt).toContain('Alice holds PhoneX');

    // Should contain style info
    expect(prompt).toContain('golden-hour');

    // Should contain identity anchor for product
    expect(prompt).toContain('geometry');

    // Should contain composition
    expect(prompt).toContain('front view');

    // Should end with static frame reminder
    expect(prompt).toContain('Generate one static frame only');
  });

  it('stays under the character limit', () => {
    const prompt = buildImageGenerationPrompt(makeInput({ maxChars: 2000 }));
    expect(prompt.length).toBeLessThanOrEqual(2000);
  });

  it('does not contain Chinese text', () => {
    const prompt = buildImageGenerationPrompt(makeInput());
    const cjkPattern = /[\u4e00-\u9fff\u3400-\u4dbf]/;
    expect(cjkPattern.test(prompt)).toBe(false);
  });

  it('does not contain rule-based constraint patterns', () => {
    const prompt = buildImageGenerationPrompt(makeInput());
    // Should not have the old verbose constraint language
    expect(prompt).not.toContain('Priority order: locked references');
    expect(prompt).not.toContain('Treat uploaded reference images as visual ground truth');
    expect(prompt).not.toContain('Render lane');
    expect(prompt).not.toContain('Production risk');
    expect(prompt).not.toContain('Delivery intent');
    expect(prompt).not.toContain('policy: identity=');
  });

  it('handles delta-only end frame mode', () => {
    const prompt = buildImageGenerationPrompt(makeInput({
      isEndFrame: true,
      hasStartFrame: true,
      scene: {
        description: 'Alice holds PhoneX on desk.',
        endFrameDescription: 'Alice tilts PhoneX toward camera.',
        endFrameDelta: 'Phone rotated 45 degrees toward camera',
        endFrameDeltaSpec: {
          reframingGoal: 'phone fills center frame',
          mustNotChange: ['desk layout', 'lighting'],
        },
        cameraMovement: 'dolly in',
        sceneIntent: undefined,
        startComposition: undefined,
        viewIntent: undefined,
        shotIntent: undefined,
      },
    }));

    // Delta mode should be shorter
    expect(prompt.length).toBeLessThan(2000);

    // Should contain delta instruction
    expect(prompt).toContain('Phone rotated 45 degrees');
    expect(prompt).toContain('Reframing target');

    // Should contain camera interpretation
    expect(prompt).toContain('reframing');

    // Should preserve identity
    expect(prompt).toContain('Preserve');
  });

  it('omits identity anchor when no content refs', () => {
    const prompt = buildImageGenerationPrompt(makeInput({
      contentRefs: [],
    }));

    expect(prompt).not.toContain('Preserve');
    expect(prompt).not.toContain('face structure');
  });

  it('includes text/logo preservation for lock_visible_text policy', () => {
    const prompt = buildImageGenerationPrompt(makeInput({
      contentRefs: [productRef],
    }));

    expect(prompt).toContain('text and logos');
  });

  it('includes style reference description when provided', () => {
    const prompt = buildImageGenerationPrompt(makeInput({
      styleRefs: [styleRef],
    }));

    expect(prompt).toContain('Cinematic warm color grading');
  });

  it('handles custom prompt in replace mode', () => {
    const prompt = buildImageGenerationPrompt(makeInput({
      customPrompt: 'A completely different scene with a red car.',
      promptMode: 'replace',
    }));

    expect(prompt).toContain('red car');
    // Original scene description should not be the primary content
    // (it may still appear in entity descriptions from refs)
  });

  it('handles continuation from previous scene', () => {
    const prompt = buildImageGenerationPrompt(makeInput({
      hasPreviousEndFrame: true,
    }));

    expect(prompt).toContain('continues from the previous scene');
  });

  it('includes negative prompts as parenthetical', () => {
    const prompt = buildImageGenerationPrompt(makeInput());

    expect(prompt).toContain('avoid:');
    expect(prompt).toContain('blurry');
  });
});
