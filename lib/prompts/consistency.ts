/**
 * Cross-scene consistency helpers. Built from industry best practices (2026):
 *
 *  - Identity anchors: reuse the same short identity block unchanged every shot
 *    (Apatero 2026 guide, CinemaDrop "character bible" approach).
 *  - Negative-prompt drift guards: generic negatives that discourage common
 *    identity drift — shown to cut feature variance 30–40 % in diffusion
 *    guidance literature.
 *  - Prompt ordering: subject first, style after, so atmospheric tokens don't
 *    dilute identity (GensGPT 2026 guide).
 *  - Kling/Seedance 4-part structure: Subject · Action · Context · Style
 *    (fal.ai Kling 2.6 prompt guide).
 *
 * These helpers are additive — they compose with the existing section builders
 * in `image-prompt-sections.ts` and `invariant-layers.ts`.
 */
import type { ProjectReference, StyleProfile, WorkflowStage } from '@/lib/types/storyboard';

/** Default negative-prompt guards for identity drift (English, short tokens). */
export const DEFAULT_CONSISTENCY_NEGATIVES: readonly string[] = [
  'different face',
  'inconsistent features',
  'changed eye color',
  'altered hair length',
  'new facial hair',
  'new tattoos',
  'outfit change',
  'different skin tone',
  'extra limbs',
  'warped anatomy',
];

/** Product-specific negatives (geometry / branding drift). */
export const DEFAULT_PRODUCT_NEGATIVES: readonly string[] = [
  'different proportions',
  'changed colorway',
  'new logo',
  'relocated buttons',
  'extra ports',
  'mismatched material finish',
];

/** Cinematic framing negatives (avoid the model re-interpreting static frames). */
export const STATIC_FRAME_NEGATIVES: readonly string[] = [
  'motion blur',
  'duplicate subject',
  'multiple frames',
  'collage',
  'split screen',
];

/**
 * Merge user-supplied negative prompts with drift-prevention defaults based on
 * the references in play. Dedupes and caps at `maxTokens`.
 */
export function buildNegativePromptGuards(
  refs: ProjectReference[],
  options: {
    userNegatives?: string;
    includeStaticFrame?: boolean;
    maxTokens?: number;
  } = {}
): string {
  const { userNegatives, includeStaticFrame = false, maxTokens = 18 } = options;

  const hasCharacter = refs.some((r) => r.type === 'character');
  const hasProduct = refs.some((r) => r.type === 'product');

  const tokens: string[] = [];

  // Parse user negatives first so they take precedence in ordering
  if (userNegatives?.trim()) {
    tokens.push(
      ...userNegatives
        .split(/[;；,\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }

  if (hasCharacter) tokens.push(...DEFAULT_CONSISTENCY_NEGATIVES);
  if (hasProduct) tokens.push(...DEFAULT_PRODUCT_NEGATIVES);
  if (includeStaticFrame) tokens.push(...STATIC_FRAME_NEGATIVES);

  // Dedupe case-insensitively, preserve first occurrence
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const t of tokens) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(t);
    if (deduped.length >= maxTokens) break;
  }

  return deduped.join(', ');
}

/**
 * Build a short "identity bible" line — one phrase per entity, reused
 * verbatim across every shot in a project. Stability of exact wording
 * matters more than richness of description.
 */
export function buildIdentityBibleLines(refs: ProjectReference[]): string[] {
  return refs
    .filter((r) => r.type === 'character' || r.type === 'product')
    .map((r) => {
      const tag = r.name ? `<${r.name}>` : r.type;
      const core = r.identityCore?.trim() || r.description?.trim() || '';
      if (!core) return '';
      // Deliberately keep ≤160 chars so the same block fits across prompts
      const trimmed = core.length > 160 ? `${core.slice(0, 157).trim()}…` : core;
      return `${tag}: ${trimmed}`;
    })
    .filter(Boolean);
}

/**
 * 4-part video prompt structure: Subject · Action · Context · Style.
 * Returns a ready-to-send string; omits empty slots.
 */
export function buildVideoPromptStructured(parts: {
  subject: string;
  action: string;
  context?: string;
  style?: string;
  identityLine?: string;
  negatives?: string;
}): string {
  const segments: string[] = [];
  if (parts.subject.trim()) segments.push(`Subject: ${parts.subject.trim()}`);
  if (parts.action.trim()) segments.push(`Action: ${parts.action.trim()}`);
  if (parts.context?.trim()) segments.push(`Context: ${parts.context.trim()}`);
  if (parts.style?.trim()) segments.push(`Style: ${parts.style.trim()}`);
  if (parts.identityLine?.trim()) segments.push(parts.identityLine.trim());
  const core = segments.join('. ');
  if (!parts.negatives?.trim()) return core;
  return `${core}\nNegative: ${parts.negatives.trim()}`;
}

/**
 * Reference-count advisory: research shows moving from 3→6 reference images
 * resolves proportion drift. Callers (e.g. the reference uploader UI) can
 * use this to surface a nudge when the project is underfed.
 */
export function describeReferenceHealth(refs: ProjectReference[], type: 'character' | 'product'): {
  count: number;
  level: 'insufficient' | 'basic' | 'good' | 'excellent';
  recommendation: string;
} {
  const count = refs.filter((r) => r.type === type).length;
  if (count === 0) {
    return {
      count,
      level: 'insufficient',
      recommendation:
        type === 'character'
          ? 'Add at least one reference image — without it identity drift is likely.'
          : 'Add at least one product reference — geometry will otherwise be improvised.',
    };
  }
  if (count < 3) {
    return {
      count,
      level: 'basic',
      recommendation: 'Add two more reference angles for stable identity across shots.',
    };
  }
  if (count < 6) {
    return {
      count,
      level: 'good',
      recommendation: 'Going from 3→6 angles typically resolves proportion drift. Consider adding more.',
    };
  }
  return { count, level: 'excellent', recommendation: 'Reference set is strong for consistent generations.' };
}

/** Preferred slot order for image prompts (subject-first, style-after). */
export const PROMPT_SLOT_ORDER: readonly WorkflowStage[] | never = [] as never;

/** Convenience alias consumers can import from the barrel. */
export type { StyleProfile };
