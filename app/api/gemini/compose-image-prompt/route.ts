import { NextRequest, NextResponse } from 'next/server';
import { composeImagePromptWithGemini } from '@/lib/api/gemini';
import type { ProjectReference, Scene } from '@/lib/types/storyboard';

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
      return NextResponse.json(
        { error: 'Client-provided apiKey is not allowed' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server GEMINI_API_KEY is not set' },
        { status: 500 }
      );
    }

    if (!body?.scene) {
      return NextResponse.json(
        { error: 'Missing required field: scene' },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
