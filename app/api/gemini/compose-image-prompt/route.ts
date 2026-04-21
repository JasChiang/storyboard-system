import { NextRequest, NextResponse } from 'next/server';
import { composeImagePromptWithGemini } from '@/lib/api/gemini';
import type { ProjectReference, Scene } from '@/lib/types/storyboard';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      scene: Pick<Scene, 'id' | 'sceneNumber' | 'description' | 'cameraMovement' | 'sceneIntent' | 'startComposition' | 'subjectMotion' | 'continuityLock' | 'requiresEndFrame' | 'endFrameDescription' | 'endFrameDelta' | 'beatGoal' | 'shotIntent' | 'continuityAnchor' | 'changeFromPrev' | 'viewIntent' | 'referenceViewHints' | 'referencePlan' | 'requiredReferences' | 'charactersUsed' | 'productsUsed'>;
      manualEndFrameDescription?: string;
      references?: ProjectReference[];
      stylePrompt?: string;
      negativePrompt?: string;
      hasPreviousEndFrame?: boolean;
      startFramePrompt?: string;
      previousSceneDescription?: string;
      nextSceneDescription?: string;
    };

    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, 'Server GEMINI_API_KEY is not set');
    }

    if (!body?.scene) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing required field: scene');
    }

    const result = await composeImagePromptWithGemini(
      {
        scene: body.scene,
        manualEndFrameDescription: body.manualEndFrameDescription,
        references: body.references || [],
        stylePrompt: body.stylePrompt,
        negativePrompt: body.negativePrompt,
        hasPreviousEndFrame: Boolean(body.hasPreviousEndFrame),
        startFramePrompt: body.startFramePrompt,
        previousSceneDescription: body.previousSceneDescription,
        nextSceneDescription: body.nextSceneDescription,
      },
      { apiKey }
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Compose image prompt error:', error);
    return apiErrorFromUnknown(error, { message: 'Compose image prompt failed' });
  }
}
