import { NextRequest, NextResponse } from 'next/server';
import { planIndexTtsVoiceovers } from '@/lib/api/openrouter';
import type { IndexTtsScenePlanningInput } from '@/lib/types/audio';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

interface VoiceoverParamsRequestBody {
  storyboardTitle?: string;
  originalPrompt?: string;
  voiceDirection?: string;
  audioUrl?: string;
  emotionalAudioUrl?: string;
  scenes?: IndexTtsScenePlanningInput[];
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeScenes(value: unknown): IndexTtsScenePlanningInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const sceneId = normalizeText(raw.sceneId);
      const sourceText = normalizeText(raw.sourceText);
      const sourceLabel = raw.sourceLabel === 'dialogue' ? 'dialogue' : 'description';
      const sceneNumber = Number(raw.sceneNumber);
      const duration = Number(raw.duration);

      if (!sceneId || !sourceText || !Number.isFinite(sceneNumber) || !Number.isFinite(duration)) {
        return null;
      }

      return {
        sceneId,
        sceneNumber,
        duration,
        description: normalizeText(raw.description),
        dialogue: normalizeText(raw.dialogue),
        notes: normalizeText(raw.notes),
        sourceLabel,
        sourceText,
      } as IndexTtsScenePlanningInput;
    })
    .filter((item): item is IndexTtsScenePlanningInput => item !== null);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VoiceoverParamsRequestBody & { apiKey?: string };
    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
    }

    const audioUrl = normalizeText(body.audioUrl);
    if (!audioUrl) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'audioUrl is required');
    }

    const scenes = normalizeScenes(body.scenes);
    if (scenes.length === 0) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'scenes is required');
    }

    const plans = await planIndexTtsVoiceovers(
      {
        storyboardTitle: normalizeText(body.storyboardTitle),
        originalPrompt: normalizeText(body.originalPrompt),
        voiceDirection: normalizeText(body.voiceDirection),
        audioUrl,
        emotionalAudioUrl: normalizeText(body.emotionalAudioUrl),
        scenes,
      },
      { apiKey }
    );

    return NextResponse.json({ success: true, data: { plans } });
  } catch (error) {
    console.error('Generate voiceover params error:', error);
    return apiErrorFromUnknown(error, { message: 'Generate voiceover params failed' });
  }
}
