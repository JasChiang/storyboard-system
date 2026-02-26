import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@/lib/prompts';

const REQUIRED_SCENE_FIELDS = [
  'sceneNumber',
  'description',
  'cameraMovement',
  'sceneIntent',
  'startComposition',
  'subjectMotion',
  'continuityLock',
  'shotIntent',
  'continuityAnchor',
  'requiresEndFrame',
  'endFrameDelta',
  'dialogue',
  'duration',
  'charactersUsed',
  'productsUsed',
  'changeFromPrev',
  'requiredReferences',
  'transitionToNext',
] as const;

describe('storyboard template schemas', () => {
  it('all templates contain downstream generation contract fields', () => {
    for (const template of TEMPLATES) {
      const schema = template.outputSchema as Record<string, unknown>;
      const scenes = (schema.properties as Record<string, unknown>)?.scenes as Record<string, unknown>;
      const sceneItem = scenes?.items as Record<string, unknown>;
      const sceneRequired = Array.isArray(sceneItem?.required) ? sceneItem.required as string[] : [];
      const sceneProps = (sceneItem?.properties || {}) as Record<string, unknown>;

      for (const field of REQUIRED_SCENE_FIELDS) {
        expect(sceneProps[field], `${template.id} missing scene property: ${field}`).toBeDefined();
        expect(sceneRequired.includes(field), `${template.id} missing required scene field: ${field}`).toBe(true);
      }
    }
  });
});

