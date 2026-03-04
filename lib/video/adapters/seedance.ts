import type { ProjectReference, Scene } from '@/lib/types/storyboard';
import { buildConsolidatedReferenceRules } from '@/lib/references/consistency-rules';
import { buildIdentityLockPromptLine } from '@/lib/references/identity-lock';
import { analyzeMotionRisk, buildMotionSafetyLines } from './motion-safety';
import { buildPromptFromSchema } from './prompt-schema';
import { buildVideoSceneScriptLines } from './scene-script';

interface SeedancePromptInput {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
  continuityMemoryLines?: string[];
}

export function buildSeedancePrompt({ scene, motionPrompt, scopedRefs, continuityMemoryLines = [] }: SeedancePromptInput): string {
  const consolidatedRules = buildConsolidatedReferenceRules(scopedRefs);

  const identityCoreLines = consolidatedRules
    .filter(rule => rule.identityCore)
    .map(rule => `${rule.tag}: ${rule.identityCore}`);

  const mustKeepLines = consolidatedRules
    .filter(rule => rule.mustKeepFeatures?.length)
    .map(rule => `${rule.tag}: ${rule.mustKeepFeatures.slice(0, 6).join(', ')}`);

  const guidelineLines = consolidatedRules
    .filter(rule => rule.guidelines.length > 0)
    .map(rule => `${rule.tag}: ${rule.guidelines.slice(0, 6).join('; ')}`);
  const structuredLockLines = consolidatedRules
    .filter(rule => rule.structuredIdentityLock)
    .map(rule => buildIdentityLockPromptLine(rule.structuredIdentityLock!, rule.tag));

  const identityInvariants = [
    structuredLockLines.length ? `Apply structured identity locks: ${structuredLockLines.join(' | ')}` : '',
    identityCoreLines.length ? `Keep identity cores fixed: ${identityCoreLines.join(' | ')}` : '',
    mustKeepLines.length ? `Keep material/geometry constraints: ${mustKeepLines.join(' | ')}` : '',
    guidelineLines.length ? `Follow guardrails: ${guidelineLines.join(' | ')}` : '',
    'Keep character/product identity, logo placement, and core geometry unchanged.',
  ].filter(Boolean);

  const hasLockVisibleText = scopedRefs.some(ref => ref.ipProfile?.textLogoPolicy === 'lock_visible_text');
  const hasForbidNewText = scopedRefs.some(ref => ref.ipProfile?.textLogoPolicy === 'forbid_new_text');
  const hasEndFrame = !!scene.requiresEndFrame && !!scene.generatedEndFrame?.url;
  const motionRisk = analyzeMotionRisk({ scene, motionPrompt, scopedRefs });
  const motionSafetyLines = buildMotionSafetyLines({ scene, motionPrompt, scopedRefs });
  const sceneScriptLines = buildVideoSceneScriptLines(scene);
  const cameraMotionParts = [
    scene.cameraMovement?.trim() ? `Storyboard camera movement: ${scene.cameraMovement.trim()}.` : '',
    motionPrompt?.trim() || '',
  ].filter(Boolean);
  const cameraPlan = cameraMotionParts.join(' ').trim() || 'Keep camera motion smooth and physically plausible.';

  return buildPromptFromSchema({
    heading: 'Seedance scene direction.',
    shotGoal: motionRisk.riskyCrossSubjectHandoff
      ? 'Keep the anchored product stable while performing only a subtle reframe within visible scene content.'
      : hasEndFrame
      ? 'Align the final moment with the provided end frame.'
      : 'Maintain narrative continuity within one shot with no explicit end frame target.',
    cameraPlan: `Generate a smooth single-shot motion sequence from the start frame. ${cameraPlan}`,
    subjectState: [
      ...sceneScriptLines,
      ...continuityMemoryLines,
      'Use one continuous motion path for the whole clip; keep transitions inside the shot smooth.',
      'Keep movement readable with clear camera intent and stable anchored subjects.',
      'Prefer stable temporal continuity and realistic inertia; avoid sudden perspective jumps.',
      ...motionSafetyLines,
      'No audio guidance required in prompt; optimize for visual continuity and timing.',
    ],
    identityInvariants,
    hardNegatives: [
      'Do not introduce new props, clothing changes, or logo/text mutations.',
      'No jump cuts, montage edits, abrupt lens swaps, or identity flicker between frames.',
      'Avoid keyword stuffing such as "masterpiece, best quality, 8k, ultra-detailed".',
      motionRisk.riskyCrossSubjectHandoff
        ? 'Do not fake large reframing by moving or scaling the anchored product.'
        : '',
      hasLockVisibleText ? 'If text or logos are visible, keep spelling, shape, and placement exactly unchanged.' : '',
      hasForbidNewText ? 'Never invent new letters, numbers, logos, or package text during motion.' : '',
    ],
  });
}
