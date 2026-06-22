import { NextRequest, NextResponse } from 'next/server';
import { composeVideoPromptWithGemini } from '@/lib/api/gemini';
import type { ProjectReference, Scene } from '@/lib/types/storyboard';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      model: 'seedance';
      scene: Pick<Scene, 'id' | 'sceneNumber' | 'description' | 'cameraMovement' | 'sceneIntent' | 'startComposition' | 'subjectMotion' | 'continuityLock' | 'shotIntent' | 'continuityAnchor' | 'changeFromPrev' | 'requiresEndFrame' | 'endFrameDescription' | 'viewIntent' | 'referenceViewHints' | 'referencePlan' | 'requiredReferences' | 'charactersUsed' | 'productsUsed'>;
      motionPrompt?: string;
      references?: ProjectReference[];
      continuityMemoryLines?: string[];
      hasPreviousEndFrame?: boolean;
    };

    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, 'Server GEMINI_API_KEY is not set');
    }

    if (!body?.model || !body?.scene) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing required fields: model, scene');
    }

    const motionPrompt = body.motionPrompt?.trim()
      || body.scene.cameraMovement?.trim()
      || body.scene.description?.trim()
      || 'Keep camera motion smooth and physically plausible.';

    const result = await composeVideoPromptWithGemini(
      {
        model: body.model,
        scene: body.scene,
        motionPrompt,
        references: body.references || [],
        continuityMemoryLines: Array.isArray(body.continuityMemoryLines) ? body.continuityMemoryLines : [],
        hasPreviousEndFrame: Boolean(body.hasPreviousEndFrame),
      },
      { apiKey }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Compose video prompt error:', error);
    return apiErrorFromUnknown(error, { message: 'Compose video prompt failed' });
  }
}
