/**
 * Central barrel for the prompts module.
 *
 * Use this instead of reaching into individual files:
 *   import { buildImageGenerationPrompt, TEMPLATES } from '@/lib/prompts';
 *
 * Sub-path imports (e.g. `@/lib/prompts/continuity-memory`) still work for
 * backwards compatibility with existing tests and routes.
 */

// Style templates
import { DEFAULT_STORYBOARD_TEMPLATE } from './templates/default';
import { COMMERCIAL_TEMPLATE } from './templates/commercial';
import { MUSIC_VIDEO_TEMPLATE } from './templates/music-video';
import { DOCUMENTARY_TEMPLATE } from './templates/documentary';
import { TECH_PRODUCT_TEMPLATE } from './templates/tech-product';
import { SHORTS_HOOK_TEMPLATE } from './templates/shorts-hook';
import type { PromptTemplate } from '@/lib/types/storyboard';

export const TEMPLATES: PromptTemplate[] = [
  DEFAULT_STORYBOARD_TEMPLATE,
  COMMERCIAL_TEMPLATE,
  TECH_PRODUCT_TEMPLATE,
  SHORTS_HOOK_TEMPLATE,
  MUSIC_VIDEO_TEMPLATE,
  DOCUMENTARY_TEMPLATE,
];

export {
  DEFAULT_STORYBOARD_TEMPLATE,
  COMMERCIAL_TEMPLATE,
  TECH_PRODUCT_TEMPLATE,
  SHORTS_HOOK_TEMPLATE,
  MUSIC_VIDEO_TEMPLATE,
  DOCUMENTARY_TEMPLATE,
};

// Public builders
export { buildImageGenerationPrompt, type ImagePromptInput } from './image-prompt';
export { buildContinuityMemoryLines } from './continuity-memory';
export { buildSceneDirectiveLines } from './scene-directives';
export { normalizePromptParts } from './prompt-normalizer';
export {
  buildStaticFrameDescription,
  sanitizeStaticFrameDescription,
} from './image-static';
export {
  buildImageReferenceConstraintLines,
  buildImageIdentityConstraintLines,
  buildVideoIdentityLine,
  buildVideoIdentityInvariantLines,
} from './invariant-layers';
export {
  buildStyleSection,
  buildSubjectSection,
  buildCompositionSection,
  buildIdentityAnchorSection,
  buildContinuitySummary,
  buildDeltaSection,
  buildStyleReferenceSection,
} from './image-prompt-sections';
export {
  STORYBOARD_CONTRACT_PROMPT_BLOCK,
  STORYBOARD_VIEW_INTENTS,
  buildStoryboardOutputSchema,
} from './storyboard-contract';

// Consistency helpers (new)
export {
  DEFAULT_CONSISTENCY_NEGATIVES,
  DEFAULT_PRODUCT_NEGATIVES,
  STATIC_FRAME_NEGATIVES,
  buildNegativePromptGuards,
  buildIdentityBibleLines,
  buildVideoPromptStructured,
  describeReferenceHealth,
} from './consistency';
