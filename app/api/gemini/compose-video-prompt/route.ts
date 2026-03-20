import { NextRequest, NextResponse } from 'next/server';
import { composeVideoPromptWithGemini } from '@/lib/api/gemini';
import type { ProjectReference, Scene } from '@/lib/types/storyboard';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      model: 'kling' | 'seedance';
      scene: Pick<Scene, 'id' | 'sceneNumber' | 'description' | 'cameraMovement' | 'sceneIntent' | 'startComposition' | 'subjectMotion' | 'continuityLock' | 'shotIntent' | 'continuityAnchor' | 'changeFromPrev' | 'requiresEndFrame' | 'endFrameDescription' | 'viewIntent' | 'referenceViewHints' | 'referencePlan' | 'requiredReferences' | 'charactersUsed' | 'productsUsed'>;
      motionPrompt?: string;
      references?: ProjectReference[];
      continuityMemoryLines?: string[];
      hasPreviousEndFrame?: boolean;
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

    if (!body?.model || !body?.scene) {
      return NextResponse.json(
        { error: 'Missing required fields: model, scene' },
        { status: 400 }
      );
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
