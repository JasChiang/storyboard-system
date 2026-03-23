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

export function buildImageIdentityConstraintLines(
  refs: ProjectReference[],
  options?: { includeFallbackObjectIdentity?: boolean }
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
