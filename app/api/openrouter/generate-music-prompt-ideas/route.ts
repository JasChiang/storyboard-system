import { NextRequest, NextResponse } from 'next/server';
import { suggestElevenLabsMusicPrompts } from '@/lib/api/openrouter';

interface MusicPromptIdeaSceneInput {
  sceneNumber: number;
  duration: number;
  description?: string;
  dialogue?: string;
  notes?: string;
  cameraMovement?: string;
}

interface MusicPromptIdeasRequestBody {
  storyboardTitle?: string;
  originalPrompt?: string;
  currentPrompt?: string;
  targetDurationSec?: number;
  scenes?: MusicPromptIdeaSceneInput[];
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeScene(value: unknown): MusicPromptIdeaSceneInput | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const sceneNumber = Number(raw.sceneNumber);
  const duration = Number(raw.duration);
  if (!Number.isFinite(sceneNumber) || !Number.isFinite(duration)) return null;

  return {
    sceneNumber,
    duration,
    description: normalizeText(raw.description),
    dialogue: normalizeText(raw.dialogue),
    notes: normalizeText(raw.notes),
    cameraMovement: normalizeText(raw.cameraMovement),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MusicPromptIdeasRequestBody & { apiKey?: string };
    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return NextResponse.json(
        { error: 'Client-provided apiKey is not allowed' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    const scenes = Array.isArray(body.scenes)
      ? body.scenes.map((scene) => normalizeScene(scene)).filter((scene): scene is MusicPromptIdeaSceneInput => scene !== null)
      : [];

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: 'scenes is required' },
        { status: 400 }
      );
    }

    const ideas = await suggestElevenLabsMusicPrompts(
      {
        storyboardTitle: normalizeText(body.storyboardTitle),
        originalPrompt: normalizeText(body.originalPrompt),
        currentPrompt: normalizeText(body.currentPrompt),
        targetDurationSec: Number.isFinite(Number(body.targetDurationSec)) ? Number(body.targetDurationSec) : undefined,
        scenes,
      },
      { apiKey }
    );

    return NextResponse.json({ success: true, data: { ideas } });
  } catch (error) {
    console.error('Generate music prompt ideas error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generate music prompt ideas failed' },
      { status: 500 }
    );
  }
}
