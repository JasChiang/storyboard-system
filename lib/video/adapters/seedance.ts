import type { ProjectReference, Scene } from '@/lib/types/storyboard';

interface SeedancePromptInput {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
}

export function buildSeedancePrompt({ scene, motionPrompt, scopedRefs }: SeedancePromptInput): string {
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
    'Seedance scene direction:',
    'Generate a smooth, story-driven motion sequence from the start frame.',
    hasEndFrame
      ? 'End-state target: align final moment with the provided end frame.'
      : 'No explicit end frame target; maintain narrative continuity within one shot.',
    `Action beat: ${motionPrompt}`,
    'Keep movement natural and readable, with clear subject intent and staging.',
    'No audio is required; optimize for visual continuity and timing only.',
    'Do not introduce new props, clothing changes, or logo/text mutations.',
    hasLockVisibleText ? 'If text or logos are visible, keep spelling, shape, and placement exactly unchanged.' : '',
    hasForbidNewText ? 'Never invent new letters, numbers, logos, or package text during motion.' : '',
    identityParts.length
      ? identityParts.join(' ')
      : 'Keep character/product identity, logo placement, and core geometry unchanged.',
  ];

  return sections.filter(Boolean).join(' ');
}
