import type { ProjectReference, Scene } from '@/lib/types/storyboard';
import { buildVideoIdentityLine } from '@/lib/prompts/invariant-layers';
import { analyzeMotionRisk, buildMotionSafetyLines } from './motion-safety';
import { buildVideoPromptFromParts } from './prompt-schema';
import { buildVideoSceneScriptLines } from './scene-script';

interface SeedancePromptInput {
  scene: Scene;
  motionPrompt: string;
  scopedRefs: ProjectReference[];
  continuityMemoryLines?: string[];
}

/**
 * Build a natural-language video prompt for Seedance image-to-video.
 *
 * Follows Seedance best practices:
 * - Do NOT re-describe the start frame image
 * - Focus on motion, action, and camera movement
 * - Write like directing a film — clear sentences, present tense
 * - Use "then" / "followed by" for sequential actions
 * - NO negative prompts (Seedance does not process them)
 * - Keep prompts concise (~60 words + constraints)
 */
export function buildSeedancePrompt({ scene, motionPrompt, scopedRefs, continuityMemoryLines = [] }: SeedancePromptInput): string {
  const motionRisk = analyzeMotionRisk({ scene, motionPrompt, scopedRefs });
  const motionSafetyLines = buildMotionSafetyLines({ scene, motionPrompt, scopedRefs });
  const sceneScriptLines = buildVideoSceneScriptLines(scene);

  // Action lines: subject motion first, then safety constraints
  const actionLines: string[] = [
    ...sceneScriptLines,
    ...motionSafetyLines,
  ];

  // Continuity memory — only include anchor/lock lines, skip headers
  const anchorLines = continuityMemoryLines.filter(l => /^Shot \d+:/.test(l));
  if (anchorLines.length > 0) {
    actionLines.push(`Previous shots: ${anchorLines.join('. ')}`);
  }

  // Camera motion
  const cameraParts: string[] = [];
  if (scene.cameraMovement?.trim()) {
    cameraParts.push(scene.cameraMovement.trim());
  }
  if (motionPrompt?.trim()) {
    cameraParts.push(motionPrompt.trim());
  }
  const cameraMotion = cameraParts.join(', ') || 'Smooth stable camera';

  // Shot goal override for risky scenarios
  if (motionRisk.riskyCrossSubjectHandoff) {
    actionLines.unshift('Keep the anchored product stable, only perform a subtle reframe within visible content');
  }

  // End frame alignment
  const hasEndFrame = !!scene.requiresEndFrame && !!scene.generatedEndFrame?.url;
  if (hasEndFrame) {
    actionLines.push('Match the provided end frame composition at the end of the shot');
  }

  // Identity line
  const identityLine = buildVideoIdentityLine(scopedRefs);

  // Seedance does NOT support negative prompts — omit entirely
  return buildVideoPromptFromParts({
    cameraMotion,
    actionLines,
    identityLine: identityLine || undefined,
    // No negatives for Seedance
  });
}
