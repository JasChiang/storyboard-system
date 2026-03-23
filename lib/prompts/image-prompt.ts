import type { ProjectReference, Scene, StyleProfile, ViewIntent, WorkflowStage } from '@/lib/types/storyboard';
import { buildStaticFrameDescription, sanitizeStaticFrameDescription } from '@/lib/prompts/image-static';
import { normalizePromptParts } from '@/lib/prompts/prompt-normalizer';
import {
  buildStyleSection,
  buildSubjectSection,
  buildCompositionSection,
  buildIdentityAnchorSection,
  buildContinuitySummary,
  buildDeltaSection,
  buildStyleReferenceSection,
} from '@/lib/prompts/image-prompt-sections';

export interface ImagePromptInput {
  // Scene data
  scene: Pick<Scene,
    'description' | 'cameraMovement' | 'sceneIntent' | 'startComposition' |
    'endFrameDescription' | 'endFrameDelta' | 'endFrameDeltaSpec' |
    'viewIntent' | 'shotIntent'
  >;
  isEndFrame: boolean;
  /** True when an existing start frame image is available (enables delta-only mode) */
  hasStartFrame: boolean;

  // Custom prompt overlay
  customPrompt?: string;
  promptMode?: 'append' | 'replace' | 'prepend';

  // References (already routed / scoped to this scene)
  contentRefs: ProjectReference[];
  styleRefs: ProjectReference[];
  viewIntent?: ViewIntent;

  // Style
  styleProfile?: StyleProfile;

  // Continuity
  continuityMemoryLines?: string[];
  hasPreviousEndFrame?: boolean;

  // Limits
  maxChars?: number;
}

/**
 * Build a natural-language prompt optimised for nano banana pro (Gemini 3 Pro Image).
 *
 * Structure follows Google DeepMind's recommended format:
 *   Style → Subject → Composition → Identity Anchor → Continuity
 *
 * For end-frame delta mode (isEndFrame + hasStartFrame):
 *   Style → Delta instruction → Identity Anchor
 */
export function buildImageGenerationPrompt(input: ImagePromptInput): string {
  const {
    scene,
    isEndFrame,
    hasStartFrame,
    customPrompt,
    promptMode = 'append',
    contentRefs,
    styleRefs,
    styleProfile,
    continuityMemoryLines = [],
    hasPreviousEndFrame = false,
    maxChars = 4000,
  } = input;

  const stage: WorkflowStage = isEndFrame ? 'image_end' : 'image_start';
  const parts: string[] = [];

  // ── 1. STYLE ──────────────────────────────────────────────────────────
  const styleLine = buildStyleSection(styleProfile, stage);
  if (styleLine) parts.push(styleLine);

  // ── Delta-only mode (end frame with existing start frame) ─────────────
  if (isEndFrame && hasStartFrame) {
    const delta = scene.endFrameDelta || scene.endFrameDescription || '';
    if (delta.trim()) {
      parts.push(...buildDeltaSection(
        delta,
        scene.endFrameDeltaSpec,
        scene.cameraMovement
      ));
    } else {
      // No explicit delta — use end frame description as target
      const desc = sanitizeStaticFrameDescription(scene.endFrameDescription || scene.description);
      parts.push(`Target end frame: ${desc}`);
    }

    // Continuity anchor for delta mode
    parts.push(...buildContinuitySummary(continuityMemoryLines, false, true, true));

    // Identity anchor
    parts.push(...buildIdentityAnchorSection(contentRefs));

    // Style references
    const styleRefLine = buildStyleReferenceSection(styleRefs);
    if (styleRefLine) parts.push(styleRefLine);

    return normalizePromptParts(parts, maxChars);
  }

  // ── 2. SUBJECT (normal mode) ──────────────────────────────────────────
  const sceneDescription = buildStaticFrameDescription(
    scene.description,
    isEndFrame ? (scene.endFrameDescription || scene.description) : scene.description,
    isEndFrame
  );

  const safeCustom = customPrompt ? sanitizeStaticFrameDescription(customPrompt) : '';

  if (!safeCustom) {
    parts.push(...buildSubjectSection(sceneDescription, contentRefs));
  } else {
    switch (promptMode) {
      case 'replace':
        parts.push(...buildSubjectSection(safeCustom, contentRefs));
        break;
      case 'prepend':
        parts.push(safeCustom);
        parts.push(...buildSubjectSection(sceneDescription, contentRefs));
        break;
      case 'append':
      default:
        parts.push(...buildSubjectSection(sceneDescription, contentRefs));
        parts.push(safeCustom);
        break;
    }
  }

  // ── 3. COMPOSITION ────────────────────────────────────────────────────
  const compositionLine = buildCompositionSection(scene);
  if (compositionLine) parts.push(compositionLine);

  // ── 4. IDENTITY ANCHOR ────────────────────────────────────────────────
  parts.push(...buildIdentityAnchorSection(contentRefs));

  // ── 5. CONTINUITY ─────────────────────────────────────────────────────
  parts.push(...buildContinuitySummary(
    continuityMemoryLines,
    hasPreviousEndFrame,
    false,
    isEndFrame
  ));

  // ── 6. STYLE REFERENCES ──────────────────────────────────────────────
  const styleRefLine = buildStyleReferenceSection(styleRefs);
  if (styleRefLine) parts.push(styleRefLine);

  // ── Static frame reminder ─────────────────────────────────────────────
  parts.push('Generate one static frame only.');

  return normalizePromptParts(parts, maxChars);
}
