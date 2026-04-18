/**
 * Barrel for the references module. Consumers can import from a single path:
 *   import { buildStructuredIdentityLock, splitSceneReferencesByPriority } from '@/lib/references';
 *
 * Existing sub-path imports continue to work.
 */
export {
  buildStructuredIdentityLock,
  mergeStructuredIdentityLocks,
  buildIdentityLockPromptLine,
} from './identity-lock';

export { buildConsolidatedReferenceRules } from './consistency-rules';

export {
  getSceneReferencePlan,
  buildSceneReferencePlanLines,
  getReferencePlanItemForTag,
} from './reference-plan';

export { buildPrioritizedReferenceUrls } from './reference-priority';

export { splitSceneReferencesByPriority } from './reference-routing';

export {
  getReferenceTag,
  getSceneRequiredTags,
  getSceneEntityTags,
  getSceneRelevantReferences,
  inferSceneViewIntent,
  normalizeTag,
} from './scene-references';
