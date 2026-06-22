import type { ImageGenerationModel } from '@/lib/constants/image-models';
import type { ProjectReference, ReferencePriorityMode, WorkflowStage } from '@/lib/types/storyboard';

const MAX_REFERENCE_IMAGES: Record<ImageGenerationModel, number> = {
  'gpt-image-2': 10,
  'nano-banana-pro': 14,
  'seedream-5-lite': 4,
};

interface BuildPrioritizedReferenceUrlsInput {
  model: ImageGenerationModel;
  continuityReferenceUrl?: string;
  startFrameReferenceUrl?: string;
  sceneReferenceUrl?: string | null;
  requiredContentRefs?: ProjectReference[];
  optionalContentRefs?: ProjectReference[];
  styleReferenceUrls?: string[];
  prioritizeContentRefs?: boolean;
  strictRequiredOnlyWhenPresent?: boolean;
  includeStyleReferenceImages?: boolean;
  stage?: WorkflowStage;
  priorityMode?: ReferencePriorityMode;
}

function appendUniqueUrl(target: string[], raw?: string | null) {
  if (typeof raw !== 'string') return;
  const normalized = raw.trim();
  if (!normalized) return;
  if (target.includes(normalized)) return;
  target.push(normalized);
}

function appendRefs(target: string[], refs: ProjectReference[]) {
  refs.forEach((ref) => appendUniqueUrl(target, ref.url));
}

export function buildPrioritizedReferenceUrls(
  input: BuildPrioritizedReferenceUrlsInput
): string[] {
  const ordered: string[] = [];
  const requiredContentRefs = input.requiredContentRefs || [];
  const optionalContentRefs = input.optionalContentRefs || [];
  const hasRequiredContentRefs = requiredContentRefs.length > 0;
  const includeOptionalContentRefs = !(
    input.strictRequiredOnlyWhenPresent && hasRequiredContentRefs
  );

  const mode = input.priorityMode || (
    input.stage === 'video'
      ? 'continuity_first'
      : input.stage === 'image_end'
        ? 'continuity_first'
        : input.stage === 'image_start'
          ? (input.prioritizeContentRefs ? 'identity_first' : 'stage_balanced')
          : input.prioritizeContentRefs
            ? 'identity_first'
            : 'continuity_first'
  );

  const appendIdentity = () => {
    appendRefs(ordered, requiredContentRefs);
    appendUniqueUrl(ordered, input.sceneReferenceUrl);
    if (includeOptionalContentRefs) appendRefs(ordered, optionalContentRefs);
  };
  const appendContinuity = () => {
    appendUniqueUrl(ordered, input.continuityReferenceUrl);
    appendUniqueUrl(ordered, input.startFrameReferenceUrl);
  };
  const appendStyle = () => {
    if (input.includeStyleReferenceImages === false) return;
    (input.styleReferenceUrls || []).forEach((styleUrl) => appendUniqueUrl(ordered, styleUrl));
  };

  switch (mode) {
    case 'continuity_first':
      appendContinuity();
      appendUniqueUrl(ordered, input.sceneReferenceUrl);
      appendRefs(ordered, requiredContentRefs);
      if (includeOptionalContentRefs) appendRefs(ordered, optionalContentRefs);
      appendStyle();
      break;
    case 'style_first':
      appendStyle();
      appendIdentity();
      appendContinuity();
      break;
    case 'stage_balanced':
      if (input.stage === 'image_start') {
        appendIdentity();
        appendStyle();
        appendContinuity();
      } else if (input.stage === 'image_end' || input.stage === 'video') {
        appendContinuity();
        appendIdentity();
        appendStyle();
      } else {
        appendIdentity();
        appendContinuity();
        appendStyle();
      }
      break;
    case 'identity_first':
    default:
      appendIdentity();
      appendContinuity();
      appendStyle();
      break;
  }

  const cap = MAX_REFERENCE_IMAGES[input.model] ?? 4;
  const mustKeepContinuity = input.stage === 'image_end' || input.stage === 'video';
  if (!mustKeepContinuity) {
    return ordered.slice(0, cap);
  }

  const continuityMustKeep = [input.continuityReferenceUrl, input.startFrameReferenceUrl]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim())
    .filter((value, index, arr) => arr.indexOf(value) === index);

  if (continuityMustKeep.length === 0) {
    return ordered.slice(0, cap);
  }

  const carryover = continuityMustKeep.slice(0, cap);
  const remainder = ordered.filter((url) => !carryover.includes(url));
  return [...carryover, ...remainder].slice(0, cap);
}
