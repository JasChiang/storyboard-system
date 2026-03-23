import type { ProjectReference, StyleProfile, WorkflowStage } from '@/lib/types/storyboard';
import { buildConsolidatedReferenceRules } from '@/lib/references/consistency-rules';

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function isMostlyCJK(text: string): boolean {
  const cjk = text.replace(/[^\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, '');
  return cjk.length > text.length * 0.5;
}

function pickBestDescription(ref: ProjectReference): string {
  // Prefer English-readable summary; skip CJK-heavy strings for the image model
  const candidates = [
    ref.identityCore,
    ref.description,
  ].filter((s): s is string => !!s?.trim());

  for (const c of candidates) {
    if (!isMostlyCJK(c)) return c.trim();
  }
  // All candidates are CJK — return the shortest as fallback
  return candidates[0]?.trim() || '';
}

function topFeatures(ref: ProjectReference, max = 3): string[] {
  const features = (ref.mustKeepFeatures || [])
    .map(f => f.trim())
    .filter(f => f && !isMostlyCJK(f));
  return features.slice(0, max);
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

export function buildStyleSection(
  styleProfile?: Pick<StyleProfile, 'stylePrompt' | 'negativePrompt' | 'stagePromptOverrides' | 'stageNegativeOverrides'>,
  stage?: WorkflowStage
): string {
  if (!styleProfile) return '';
  const stagePrompt = stage ? styleProfile.stagePromptOverrides?.[stage]?.trim() : '';
  const base = stagePrompt || styleProfile.stylePrompt?.trim();
  if (!base) return '';

  // Strip redundant prefix
  const cleaned = base.replace(/^rendering style:\s*/i, '').trim();

  // Append negatives as parenthetical if present
  const negSrc = (stage ? styleProfile.stageNegativeOverrides?.[stage] : '') || styleProfile.negativePrompt;
  const negatives = negSrc
    ? negSrc.split(/[;；,\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 4)
    : [];

  const negPart = negatives.length > 0 ? ` (avoid: ${negatives.join(', ')})` : '';
  return `${cleaned}${negPart}`;
}

export function buildSubjectSection(
  sceneDescription: string,
  contentRefs: ProjectReference[]
): string[] {
  const lines: string[] = [];
  if (sceneDescription.trim()) {
    lines.push(sceneDescription.trim());
  }

  // Add natural-language identity lines for each unique entity
  const consolidated = buildConsolidatedReferenceRules(contentRefs);
  for (const rule of consolidated) {
    const desc = pickBestDescription(
      contentRefs.find(r => r.name?.toLowerCase() === rule.name.toLowerCase()) || contentRefs[0]!
    );
    const features = topFeatures(
      contentRefs.find(r => r.name?.toLowerCase() === rule.name.toLowerCase()) || contentRefs[0]!
    );
    const featureSuffix = features.length > 0 ? `, featuring ${features.join(', ')}` : '';
    const typeLabel = rule.type === 'character' ? 'person/character' : 'product';
    if (desc) {
      lines.push(clip(`${rule.tag} is a ${typeLabel}: ${desc}${featureSuffix}`, 250));
    }
  }

  return lines;
}

export function buildCompositionSection(
  scene: {
    cameraMovement?: string;
    startComposition?: string;
    viewIntent?: string;
    shotIntent?: string;
  }
): string {
  const parts: string[] = [];

  // Shot intent (e.g., "highlight product texture")
  if (scene.shotIntent?.trim() && !isMostlyCJK(scene.shotIntent)) {
    parts.push(scene.shotIntent.trim());
  }

  // Camera movement reinterpreted as static framing
  if (scene.cameraMovement?.trim()) {
    const cam = scene.cameraMovement.trim().toLowerCase();
    // Map motion terms to static framing equivalents
    if (/close-?up|特寫/.test(cam)) parts.push('close-up framing');
    else if (/wide|全景|廣角/.test(cam)) parts.push('wide shot');
    else if (/medium|中景/.test(cam)) parts.push('medium shot');
    else if (/top|overhead|俯視|頂視/.test(cam)) parts.push('top-down angle');
    else if (/low angle|仰角/.test(cam)) parts.push('low angle');
  }

  // Start composition
  if (scene.startComposition?.trim() && !isMostlyCJK(scene.startComposition)) {
    parts.push(clip(scene.startComposition.trim(), 80));
  }

  // View intent
  if (scene.viewIntent && scene.viewIntent !== 'auto') {
    parts.push(`${scene.viewIntent} view`);
  }

  if (parts.length === 0) return '';
  return parts.join(', ');
}

export function buildIdentityAnchorSection(
  contentRefs: ProjectReference[]
): string[] {
  if (contentRefs.length === 0) return [];

  const lines: string[] = [];
  const hasCharacter = contentRefs.some(r => r.type === 'character');
  const hasProduct = contentRefs.some(r => r.type === 'product');
  const hasLockText = contentRefs.some(r => r.ipProfile?.textLogoPolicy === 'lock_visible_text');
  const hasForbidText = contentRefs.some(r => r.ipProfile?.textLogoPolicy === 'forbid_new_text');

  // One unified natural-language instruction
  const preserveParts: string[] = [];
  if (hasCharacter) {
    preserveParts.push('face structure, hairstyle, and outfit from the character references');
  }
  if (hasProduct) {
    preserveParts.push('exact geometry, proportions, materials, and part layout from the product references');
  }
  if (preserveParts.length > 0) {
    lines.push(`Preserve ${preserveParts.join('; and ')}.`);
  }

  if (hasLockText) {
    lines.push('Keep all visible text and logos exactly as shown in the reference images.');
  } else if (hasForbidText) {
    lines.push('Do not add any new text, numbers, or logos not present in the references.');
  }

  return lines;
}

export function buildContinuitySummary(
  memoryLines: string[],
  hasPreviousFrame: boolean,
  hasStartFrame: boolean,
  isEndFrame: boolean
): string[] {
  const lines: string[] = [];

  if (isEndFrame && hasStartFrame) {
    lines.push('Starting from the provided start frame, preserve all subjects, spatial layout, and object positions unless the delta explicitly changes them.');
  } else if (!isEndFrame && hasPreviousFrame) {
    lines.push('This scene continues from the previous scene. Keep subject identity and key objects consistent while updating composition and action as described.');
  }

  // Extract only the anchor/lock values from memory lines (skip headers and filler)
  const anchorLines = memoryLines.filter(l => /^Shot \d+:/.test(l));
  if (anchorLines.length > 0) {
    lines.push(`Previous shots context: ${anchorLines.map(l => clip(l, 100)).join('. ')}`);
  }

  return lines;
}

export function buildDeltaSection(
  endFrameDelta: string,
  deltaSpec?: {
    reframingGoal?: string;
    subjectScaleChangePct?: string;
    newVisibleArea?: string;
    mustNotChange?: string[];
  },
  cameraMovement?: string
): string[] {
  const lines: string[] = [];

  lines.push(`Change from start frame: ${endFrameDelta.trim()}`);

  if (deltaSpec?.reframingGoal) {
    lines.push(`Reframing target: ${deltaSpec.reframingGoal}`);
  }
  if (deltaSpec?.subjectScaleChangePct) {
    lines.push(`Subject scale change: ${deltaSpec.subjectScaleChangePct}`);
  }
  if (deltaSpec?.newVisibleArea) {
    lines.push(`New visible area: ${deltaSpec.newVisibleArea}`);
  }
  if (deltaSpec?.mustNotChange?.length) {
    lines.push(`Keep unchanged: ${deltaSpec.mustNotChange.join(', ')}`);
  }

  // Camera movement interpretation
  const cam = (cameraMovement || '').toLowerCase();
  if (/dolly|push|pull|zoom|拉近|拉遠|變焦/.test(cam)) {
    lines.push('Interpret camera movement as reframing, not object scaling.');
  }
  if (/pan|tilt|平移|搖鏡|轉向/.test(cam)) {
    lines.push('Pan/tilt changes only the framing window, not object positions.');
  }

  return lines;
}

export function buildStyleReferenceSection(
  styleRefs: ProjectReference[]
): string {
  if (styleRefs.length === 0) return '';
  const descs = styleRefs
    .map(r => r.description?.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (descs.length === 0) return '';
  return `Match the visual style shown in the style reference images: ${descs.join('; ')}.`;
}
