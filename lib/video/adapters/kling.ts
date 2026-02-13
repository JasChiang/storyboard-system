import type { ProjectReference, Scene } from '@/lib/types/storyboard';

interface KlingPromptInput {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
}

export function buildKlingPrompt({ scene, motionPrompt, scopedRefs }: KlingPromptInput): string {
  const identityParts: string[] = [];

  const identityCoreLines = scopedRefs
    .filter(ref => ref.identityCore)
    .map(ref => `${ref.name ? `<${ref.name}>` : ref.type}: ${ref.identityCore}`);

  const mustKeepLines = scopedRefs
    .filter(ref => ref.mustKeepFeatures?.length)
    .map(ref => `${ref.name ? `<${ref.name}>` : ref.type}: ${ref.mustKeepFeatures!.join(', ')}`);

  const guidelineLines = scopedRefs
    .filter(ref => ref.guidelines?.trim())
    .map(ref => `${ref.name ? `<${ref.name}>` : ref.type}: ${ref.guidelines!.trim()}`);

  if (identityCoreLines.length) identityParts.push(`Keep these identity cores fixed: ${identityCoreLines.join(' | ')}`);
  if (mustKeepLines.length) identityParts.push(`Do not change these identity constraints: ${mustKeepLines.join(' | ')}`);
  if (guidelineLines.length) identityParts.push(`Follow these guardrails: ${guidelineLines.join(' | ')}`);

  const hasLockVisibleText = scopedRefs.some(ref => ref.ipProfile?.textLogoPolicy === 'lock_visible_text');
  const hasForbidNewText = scopedRefs.some(ref => ref.ipProfile?.textLogoPolicy === 'forbid_new_text');
  const hasEndFrame = !!scene.requiresEndFrame && !!scene.generatedEndFrame?.url;

  const sections = [
    'Kling visual direction:',
    'Use the start frame as the visual anchor. Keep composition stable and cinematic.',
    hasEndFrame
      ? 'End-state target: match the provided end frame composition and identity.'
      : 'No explicit end frame target; preserve identity consistency through the full shot.',
    `Camera and motion directive: ${motionPrompt}`,
    'Prioritize clean camera language (pan/dolly/tilt/zoom) and coherent subject movement.',
    'Avoid temporal artifacts, warped logos, or text deformation during motion.',
    hasLockVisibleText ? 'If text or logos are visible, keep spelling, shape, and placement exactly unchanged.' : '',
    hasForbidNewText ? 'Never invent new letters, numbers, logos, or package text during motion.' : '',
    identityParts.length
      ? identityParts.join(' ')
      : 'Keep character/product identity, logo placement, and core geometry unchanged.',
  ];

  return sections.filter(Boolean).join(' ');
}
