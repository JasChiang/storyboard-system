import type { ProjectReference, ViewIntent } from '@/lib/types/storyboard';
import { buildConsolidatedReferenceRules } from '@/lib/references/consistency-rules';
import { buildIdentityLockPromptLine } from '@/lib/references/identity-lock';

function normalize(value?: string): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  lines.forEach((line) => {
    const normalized = normalize(line);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function formatReferenceEntry(ref: ProjectReference): string {
  const tag = ref.name ? `<${ref.name}>` : ref.type;
  const angle = ref.angle ? `(${ref.angle})` : '';
  const visibility = normalize(ref.angleVisibility) || normalize(ref.description);
  return visibility ? `${tag}${angle} — ${visibility}` : `${tag}${angle}`;
}

export function buildImageReferenceConstraintLines(input: {
  hasReferenceInputs: boolean;
  viewIntent?: ViewIntent;
  primaryRefs?: ProjectReference[];
  secondaryRefs?: ProjectReference[];
  lockedRefs?: ProjectReference[];
}): string[] {
  if (!input.hasReferenceInputs) return [];

  const lines: string[] = [
    'Priority order: locked references > shot composition > style treatment.',
    'Treat uploaded reference images as visual ground truth for identity, geometry, materials, and visible text.',
  ];

  const viewIntent = normalize(input.viewIntent);
  if (viewIntent) {
    lines.push(`Match the resolved shot view intent: ${viewIntent}.`);
  }

  if (input.lockedRefs?.length) {
    lines.push(
      `Locked references for this shot: ${input.lockedRefs.map((ref) => ref.name ? `<${ref.name}>` : ref.type).join(', ')}.`
    );
  }

  if (input.primaryRefs?.length) {
    lines.push(`Primary reference views for this shot: ${input.primaryRefs.map(formatReferenceEntry).join('; ')}.`);
  }

  if (input.secondaryRefs?.length) {
    lines.push(`Secondary supporting references: ${input.secondaryRefs.map(formatReferenceEntry).join('; ')}.`);
  }

  lines.push('If references show different angles of the same subject, keep one unified identity and change only view-dependent visible features.');
  lines.push('If text instructions conflict with locked references, locked references win.');

  return uniqueLines(lines);
}

/**
 * Build a single line that instructs the model to swap an eye/mouth "inner fill"
 * while keeping the outer identity layer fixed. Used when a scene/shot specifies
 * a mood (e.g. 'happy_closed', 'excited') that matches a preset in the ref's
 * featureVariants.eyes or featureVariants.mouth.
 *
 * Returns empty string when no matching variant is found (so callers can safely
 * concatenate the result into a prompt).
 */
export function buildFeatureVariantLine(
  refs: ProjectReference[],
  moods: { eyes?: string; mouth?: string }
): string {
  const lines: string[] = [];
  for (const ref of refs) {
    const tag = ref.name ? `<${ref.name}>` : ref.type;
    const fv = ref.featureVariants;
    if (!fv) continue;
    for (const key of ['eyes', 'mouth'] as const) {
      const group = fv[key];
      const mood = moods[key];
      if (!group || !mood) continue;
      const preset = group.presets.find((p) => p.mood === mood);
      if (!preset) continue;
      lines.push(
        `${tag} ${key} (${mood}): change ONLY the inner layer to "${preset.innerFill}". The outer identity layer "${group.identityLayer}" must remain exactly as in the reference images — do not change its color, shape, size, or position.`
      );
    }
  }
  return lines.length ? `Expression variant directives — ${lines.join(' | ')}` : '';
}

export function buildImageIdentityConstraintLines(
  refs: ProjectReference[],
  options?: { includeFallbackObjectIdentity?: boolean; moods?: { eyes?: string; mouth?: string } }
): string[] {
  const hasCharacterRefs = refs.some((ref) => ref.type === 'character');
  const hasProductRefs = refs.some((ref) => ref.type === 'product');
  const hasIdentityRefs = hasCharacterRefs || hasProductRefs;
  const hasLockVisibleText = refs.some((ref) => ref.ipProfile?.textLogoPolicy === 'lock_visible_text');
  const hasForbidNewText = refs.some((ref) => ref.ipProfile?.textLogoPolicy === 'forbid_new_text');

  const lines: string[] = [
    'Describe the scene in natural language, not keyword stuffing.',
    'Do not introduce new characters, props, logos, or text unless explicitly requested.',
  ];

  if (hasIdentityRefs) {
    lines.push('Anchor subject identity and product geometry to the provided references.');
  }
  if (hasCharacterRefs) {
    lines.push('Keep character identity unchanged unless explicitly requested: face structure, hairstyle, body proportions, outfit silhouette/materials, and accessories must remain stable.');
  }
  if (hasProductRefs) {
    lines.push('Keep product identity unchanged unless explicitly requested: geometry, proportions, material finish, colorway, logo/text placement, and control layout must remain stable.');
    lines.push('Keep product part topology unchanged: component count/layout, seams, handles, feet, buttons, ports, and camera clusters must match the references.');
  }
  if (!hasIdentityRefs && options?.includeFallbackObjectIdentity) {
    lines.push('Keep key object identity and layout continuity stable unless explicitly requested.');
  }
  if (hasLockVisibleText) {
    lines.push('If visible text or logos are present, keep exact spelling, shape, and placement unchanged.');
  }
  if (hasForbidNewText) {
    lines.push('Do not invent any new letters, numbers, logos, or package text.');
  }

  // v2 rendering-medium guard — prevents models from auto-3D-ifying flat mascots, etc.
  const mediums = new Set(refs.map((ref) => ref.renderingMedium).filter(Boolean));
  if (mediums.has('flat_2d')) {
    lines.push('Flat-2D mascot refs: keep vector/flat rendering with solid colors and bold outlines; do not convert to 3D, do not add gradients, shadows, or photoreal textures.');
  }
  if (mediums.has('clay_3d')) {
    lines.push('Clay/felt refs: keep handmade material quality (clay, felt, wool); do not convert to vector flat or photoreal.');
  }
  if (mediums.has('cel_3d')) {
    lines.push('Cel-shaded 3D refs: keep toon-shaded look with flat cel highlights; do not smooth into photoreal.');
  }

  // v2 drift-hotspots and action-safety — per-subject structured negatives.
  const hotspotLines: string[] = [];
  const anatomyLines: string[] = [];
  const rewriteLines: string[] = [];
  const verbAvoidance: string[] = [];
  for (const ref of refs) {
    const tag = ref.name ? `<${ref.name}>` : ref.type;
    for (const spot of ref.driftHotspots || []) {
      const failures = (spot.commonFailures || []).slice(0, 4).join(', ');
      if (!failures) continue;
      const correct = spot.correctShape ? ` Keep as: ${spot.correctShape}.` : '';
      hotspotLines.push(`${tag} ${spot.part}: avoid ${failures}.${correct}`);
    }
    for (const c of ref.actionSafety?.anatomyConstraints || []) {
      anatomyLines.push(`${tag}: ${c}`);
    }
    for (const rule of ref.actionSafety?.rewriteRules || []) {
      rewriteLines.push(`${tag}: prefer "${rule.rewrite}" over "${rule.trigger}"`);
    }
    for (const verb of ref.actionSafety?.forbiddenVerbs || []) {
      verbAvoidance.push(`${tag}: avoid verb "${verb}"`);
    }
  }
  if (hotspotLines.length) {
    lines.push(`Per-part drift guards: ${hotspotLines.slice(0, 8).join(' | ')}`);
  }
  if (anatomyLines.length) {
    lines.push(`Anatomy constraints: ${anatomyLines.slice(0, 8).join(' | ')}`);
  }
  if (rewriteLines.length) {
    lines.push(`Action phrasing: ${rewriteLines.slice(0, 6).join(' | ')}`);
  }
  if (verbAvoidance.length) {
    lines.push(`Verb avoidance (triggers wrong priors): ${verbAvoidance.slice(0, 6).join(' | ')}`);
  }

  if (options?.moods) {
    const variantLine = buildFeatureVariantLine(refs, options.moods);
    if (variantLine) lines.push(variantLine);
  }

  return uniqueLines(lines);
}

/**
 * Build a single concise identity line for video prompts.
 * Video models (Kling/Seedance) work best with minimal constraint text
 * since the start frame image already defines identity visually.
 */
export function buildVideoIdentityLine(refs: ProjectReference[]): string {
  if (!refs.length) return '';
  const hasCharacter = refs.some(r => r.type === 'character');
  const hasProduct = refs.some(r => r.type === 'product');
  const hasLockText = refs.some(r => r.ipProfile?.textLogoPolicy === 'lock_visible_text');

  const parts: string[] = [];
  if (hasCharacter && hasProduct) {
    parts.push('Keep character and product identity unchanged throughout');
  } else if (hasCharacter) {
    parts.push('Keep character identity unchanged throughout');
  } else if (hasProduct) {
    parts.push('Keep product identity and geometry unchanged throughout');
  }
  if (hasLockText) {
    parts.push('preserve all visible text and logos exactly');
  }
  return parts.join('; ');
}

/** @deprecated Use buildVideoIdentityLine for direct video prompts. This verbose version is kept for the Gemini AI composer. */
export function buildVideoIdentityInvariantLines(refs: ProjectReference[]): string[] {
  const consolidatedRules = buildConsolidatedReferenceRules(refs);
  const hasLockVisibleText = refs.some((ref) => ref.ipProfile?.textLogoPolicy === 'lock_visible_text');
  const hasForbidNewText = refs.some((ref) => ref.ipProfile?.textLogoPolicy === 'forbid_new_text');

  const structuredLockLines = consolidatedRules
    .filter((rule) => rule.structuredIdentityLock)
    .map((rule) => buildIdentityLockPromptLine(rule.structuredIdentityLock!, rule.tag));
  const identityCoreLines = consolidatedRules
    .filter((rule) => rule.identityCore)
    .map((rule) => `${rule.tag}: ${rule.identityCore}`);
  const mustKeepLines = consolidatedRules
    .filter((rule) => rule.mustKeepFeatures?.length)
    .map((rule) => `${rule.tag}: ${rule.mustKeepFeatures.slice(0, 6).join(', ')}`);
  const guidelineLines = consolidatedRules
    .filter((rule) => rule.guidelines.length > 0)
    .map((rule) => `${rule.tag}: ${rule.guidelines.slice(0, 6).join('; ')}`);

  const lines: string[] = [];
  if (structuredLockLines.length) {
    lines.push(`Apply structured identity locks: ${structuredLockLines.join(' | ')}`);
  }
  if (identityCoreLines.length) {
    lines.push(`Keep identity cores fixed: ${identityCoreLines.join(' | ')}`);
  }
  if (mustKeepLines.length) {
    lines.push(`Preserve required visible features/material cues: ${mustKeepLines.join(' | ')}`);
  }
  if (guidelineLines.length) {
    lines.push(`Follow reference guardrails: ${guidelineLines.join(' | ')}`);
  }
  lines.push('Keep character/product identity, core geometry, and visible text placement unchanged.');
  if (hasLockVisibleText) {
    lines.push('If text or logos are visible, keep exact spelling, shape, and placement unchanged.');
  }
  if (hasForbidNewText) {
    lines.push('Never invent new letters, numbers, logos, or package text.');
  }

  return uniqueLines(lines);
}
