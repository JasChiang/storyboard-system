import type { ProjectReference, Scene } from '@/lib/types/storyboard';
import { buildVideoIdentityInvariantLines } from '@/lib/prompts/invariant-layers';
import { analyzeMotionRisk, buildMotionSafetyLines } from './motion-safety';
import { buildPromptFromSchema } from './prompt-schema';
import { buildVideoSceneScriptLines } from './scene-script';

interface KlingPromptInput {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
  continuityMemoryLines?: string[];
}

export function buildKlingPrompt({ scene, motionPrompt, scopedRefs, continuityMemoryLines = [] }: KlingPromptInput): string {
  const identityInvariants = buildVideoIdentityInvariantLines(scopedRefs);
  const hasEndFrame = !!scene.requiresEndFrame && !!scene.generatedEndFrame?.url;
  const motionRisk = analyzeMotionRisk({ scene, motionPrompt, scopedRefs });
  const motionSafetyLines = buildMotionSafetyLines({ scene, motionPrompt, scopedRefs });
  const sceneScriptLines = buildVideoSceneScriptLines(scene);
  const cameraMotionParts = [
    scene.cameraMovement?.trim() ? `Storyboard camera movement: ${scene.cameraMovement.trim()}.` : '',
    motionPrompt?.trim() || '',
  ].filter(Boolean);
  const cameraPlan = cameraMotionParts.join(' ').trim() || 'Keep camera motion stable and physically plausible.';

  return buildPromptFromSchema({
    heading: 'Kling visual direction.',
    shotGoal: motionRisk.riskyCrossSubjectHandoff
      ? 'Keep the anchored product stable while performing only a subtle reframe within visible scene content.'
      : hasEndFrame
      ? 'Match the provided end frame composition and identity at the end state.'
      : 'Preserve identity consistency through the full shot with no explicit end frame target.',
    cameraPlan: `Use the start frame as the visual anchor and keep one continuous shot. ${cameraPlan}`,
    subjectState: [
      ...sceneScriptLines,
      ...continuityMemoryLines,
      'Generate one coherent camera path from first frame to last frame; no jump cuts.',
      'Prioritize clean camera language (pan/dolly/tilt/zoom) with stable anchored subjects.',
      'Prefer physically plausible motion and stable temporal continuity over aggressive reframing.',
      ...motionSafetyLines,
    ],
    identityInvariants,
    hardNegatives: [
      'Avoid temporal artifacts, warped logos, or text deformation during motion.',
      'No scene cuts, montage jumps, abrupt lens switches, or frame-to-frame identity drift.',
      'Avoid keyword stuffing such as "masterpiece, best quality, 8k, ultra-detailed".',
      motionRisk.riskyCrossSubjectHandoff
        ? 'Do not fake large reframing by moving or scaling the anchored product.'
        : '',
    ],
  });
}
