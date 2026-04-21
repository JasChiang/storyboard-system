import { NextRequest, NextResponse } from 'next/server';
import { regenerateStoryboardScene } from '@/lib/api/openrouter';
import { TEMPLATES } from '@/lib/prompts';
import type { ProjectReference, Scene } from '@/lib/types/storyboard';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      userPrompt: string;
      templateId: string;
      references?: ProjectReference[];
      sceneNumber: number;
      scene: Partial<Scene> & { sceneNumber: number };
      scenesContext: Array<Pick<Scene, 'sceneNumber' | 'description' | 'cameraMovement' | 'dialogue' | 'duration'>>;
    };
    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
    }
    if (!body.userPrompt || !body.scene?.sceneNumber) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing required fields: userPrompt, scene.sceneNumber');
    }

    const template = TEMPLATES.find((t) => t.id === body.templateId) || TEMPLATES[0];
    const scene = await regenerateStoryboardScene(
      body.userPrompt,
      template,
      body.scene,
      body.scenesContext || [],
      { apiKey },
      body.references || []
    );

    const merged = {
      description: body.scene.description || '',
      cameraMovement: body.scene.cameraMovement || 'Static shot',
      dialogue: body.scene.dialogue || '',
      duration: body.scene.duration || 5,
      ...scene,
      sceneNumber: body.sceneNumber,
    };

    return NextResponse.json({ success: true, data: { scene: merged } });
  } catch (error) {
    return apiErrorFromUnknown(error, { message: 'Regenerate scene failed' });
  }
}
