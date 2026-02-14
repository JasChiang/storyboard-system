import { NextRequest, NextResponse } from 'next/server';
import { regenerateStoryboardScene } from '@/lib/api/openrouter';
import { TEMPLATES } from '@/lib/prompts';
import type { ProjectReference, Scene } from '@/lib/types/storyboard';

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
      return NextResponse.json({ error: 'Client-provided apiKey is not allowed' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || !body.userPrompt || !body.scene?.sceneNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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
      sceneNumber: body.sceneNumber,
      description: body.scene.description || '',
      cameraMovement: body.scene.cameraMovement || 'Static shot',
      dialogue: body.scene.dialogue || '',
      duration: body.scene.duration || 5,
      ...scene,
      sceneNumber: body.sceneNumber,
    };

    return NextResponse.json({ success: true, data: { scene: merged } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Regenerate scene failed' },
      { status: 500 }
    );
  }
}
