import type { ProjectReference, Scene } from '@/lib/types/storyboard';
import { buildConsolidatedReferenceRules } from '@/lib/references/consistency-rules';
import { analyzeMotionRisk, buildMotionSafetyLines } from './motion-safety';
import { buildPromptFromSchema } from './prompt-schema';

interface KlingPromptInput {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
}

export function buildKlingPrompt({ scene, motionPrompt, scopedRefs }: KlingPromptInput): string {
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

  const identityInvariants = [
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

  return buildPromptFromSchema({
    heading: 'Kling visual direction.',
    shotGoal: motionRisk.riskyCrossSubjectHandoff
      ? 'Keep the anchored product stable while performing only a subtle reframe within visible scene content.'
      : hasEndFrame
      ? 'Match the provided end frame composition and identity at the end state.'
      : 'Preserve identity consistency through the full shot with no explicit end frame target.',
    cameraPlan: `Use the start frame as the visual anchor. ${motionPrompt}`,
    subjectState: [
      'Prioritize clean camera language (pan/dolly/tilt/zoom) with stable anchored subjects.',
      ...motionSafetyLines,
    ],
    identityInvariants,
    hardNegatives: [
      'Avoid temporal artifacts, warped logos, or text deformation during motion.',
      motionRisk.riskyCrossSubjectHandoff
        ? 'Do not fake large reframing by moving or scaling the anchored product.'
        : '',
      hasLockVisibleText ? 'If text or logos are visible, keep spelling, shape, and placement exactly unchanged.' : '',
      hasForbidNewText ? 'Never invent new letters, numbers, logos, or package text during motion.' : '',
    ],
  });
}
