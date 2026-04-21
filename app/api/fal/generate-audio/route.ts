import { NextRequest, NextResponse } from 'next/server';
import {
  generateMusicElevenLabs,
  generateMusicMiniMax,
  generateVoiceoverIndexTts,
} from '@/lib/api/fal';
import type { IndexTtsEmotionalStrengths, IndexTtsRequestInput } from '@/lib/types/audio';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

type AudioKind = 'voiceover' | 'music';
type MusicProvider = 'elevenlabs' | 'minimax';
type VoiceProvider = 'index-tts-2';

interface GenerateAudioRequest {
  kind: AudioKind;
  provider?: MusicProvider | VoiceProvider;
  text?: string;
  prompt?: string;
  durationSec?: number;
  durationMs?: number;
  lyricsPrompt?: string;

  // Voiceover (legacy/new fields)
  voiceRefUrl?: string;
  audioUrl?: string;
  audio_url?: string;
  emotionalAudioUrl?: string;
  emotional_audio_url?: string;
  emotion?: string;
  emotionPrompt?: string;
  emotion_prompt?: string;
  shouldUsePromptForEmotion?: boolean;
  should_use_prompt_for_emotion?: boolean;
  strength?: number;
  emotionalStrengths?: IndexTtsEmotionalStrengths;
  emotional_strengths?: IndexTtsEmotionalStrengths;
  input?: Partial<IndexTtsRequestInput>;
}

const EMOTION_ALIASES: Record<
  keyof Pick<IndexTtsEmotionalStrengths, 'happy' | 'angry' | 'sad' | 'afraid' | 'disgusted' | 'melancholic' | 'surprised' | 'calm'>,
  string[]
> = {
  happy: ['happy', 'happiness'],
  angry: ['angry', 'anger'],
  sad: ['sad', 'sadness'],
  afraid: ['afraid', 'fear'],
  disgusted: ['disgusted', 'disgust'],
  melancholic: ['melancholic'],
  surprised: ['surprised', 'surprise'],
  calm: ['calm', 'neutral'],
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return undefined;
}

function normalizeOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

function normalizeEmotionalStrengths(value: unknown): IndexTtsEmotionalStrengths | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const raw = value as Record<string, unknown>;
  const normalized: IndexTtsEmotionalStrengths = {};

  for (const [canonicalKey, aliases] of Object.entries(EMOTION_ALIASES) as Array<[keyof typeof EMOTION_ALIASES, string[]]>) {
    const n = aliases
      .map((alias) => normalizeOptionalNumber(raw[alias], 0, 1))
      .find((num): num is number => typeof num === 'number');
    if (typeof n === 'number') normalized[canonicalKey] = n;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function buildIndexTtsInput(body: GenerateAudioRequest): { input?: IndexTtsRequestInput; error?: string } {
  const prompt =
    normalizeText(body.prompt)
    || normalizeText(body.text)
    || normalizeText(body.input?.prompt);

  if (!prompt) {
    return { error: 'Missing prompt/text for voiceover generation' };
  }

  const audioUrl =
    normalizeText(body.audioUrl)
    || normalizeText(body.audio_url)
    || normalizeText(body.voiceRefUrl)
    || normalizeText(body.input?.audio_url)
    || normalizeText(process.env.FAL_TTS_DEFAULT_AUDIO_URL);

  if (!audioUrl) {
    return { error: 'Index TTS requires audio_url (request.audioUrl or FAL_TTS_DEFAULT_AUDIO_URL)' };
  }

  const emotionalAudioUrl =
    normalizeText(body.emotionalAudioUrl)
    || normalizeText(body.emotional_audio_url)
    || normalizeText(body.input?.emotional_audio_url);

  let shouldUsePromptForEmotion =
    normalizeOptionalBoolean(body.shouldUsePromptForEmotion)
    ?? normalizeOptionalBoolean(body.should_use_prompt_for_emotion)
    ?? normalizeOptionalBoolean(body.input?.should_use_prompt_for_emotion);

  const emotionPrompt =
    normalizeText(body.emotionPrompt)
    || normalizeText(body.emotion_prompt)
    || normalizeText(body.input?.emotion_prompt)
    || normalizeText(body.emotion);

  if (emotionPrompt && shouldUsePromptForEmotion !== true) {
    shouldUsePromptForEmotion = true;
  }

  const strength =
    normalizeOptionalNumber(body.strength, 0, 1)
    ?? normalizeOptionalNumber(body.input?.strength, 0, 1);

  const emotionalStrengths =
    normalizeEmotionalStrengths(body.emotionalStrengths)
    || normalizeEmotionalStrengths(body.emotional_strengths)
    || normalizeEmotionalStrengths(body.input?.emotional_strengths);

  const input: IndexTtsRequestInput = {
    audio_url: audioUrl,
    prompt,
  };

  if (emotionalAudioUrl) input.emotional_audio_url = emotionalAudioUrl;
  if (typeof strength === 'number') input.strength = strength;
  if (emotionalStrengths) input.emotional_strengths = emotionalStrengths;
  if (typeof shouldUsePromptForEmotion === 'boolean') {
    input.should_use_prompt_for_emotion = shouldUsePromptForEmotion;
  }
  if (emotionPrompt) input.emotion_prompt = emotionPrompt;

  return { input };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateAudioRequest & { apiKey?: string };
    const apiKey = process.env.FAL_API_KEY;

    if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
    }

    if (!apiKey) {
      return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, 'Missing FAL_API_KEY on server');
    }

    if (body.kind !== 'voiceover' && body.kind !== 'music') {
      return apiError(API_ERROR_CODES.INVALID_INPUT, 'Invalid kind. Supported: voiceover | music');
    }

    if (body.kind === 'voiceover') {
      const provider = (body.provider as VoiceProvider | undefined) || 'index-tts-2';
      if (provider !== 'index-tts-2') {
        return apiError(API_ERROR_CODES.INVALID_INPUT, `Unsupported voiceover provider: ${provider}`);
      }

      const built = buildIndexTtsInput(body);
      if (!built.input) {
        return apiError(API_ERROR_CODES.INVALID_INPUT, built.error || 'Invalid Index TTS input');
      }

      const result = await generateVoiceoverIndexTts(built.input, { apiKey });

      return NextResponse.json({
        ...result,
        endpoint: result.endpoint || process.env.FAL_TTS_INDEX_MODEL || 'fal-ai/index-tts-2/text-to-speech',
      });
    }

    const provider = (body.provider as MusicProvider | undefined) || 'elevenlabs';
    const prompt = normalizeText(body.prompt);
    if (!prompt) {
      return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing prompt for music generation');
    }

    if (provider === 'elevenlabs') {
      const normalizedDurationMs = Number.isFinite(Number(body.durationMs))
        ? Number(body.durationMs)
        : Number.isFinite(Number(body.durationSec))
          ? Math.round(Number(body.durationSec) * 1000)
          : undefined;
      const result = await generateMusicElevenLabs(
        prompt,
        { durationMs: normalizedDurationMs },
        { apiKey }
      );

      return NextResponse.json({
        ...result,
        endpoint: result.endpoint || process.env.FAL_MUSIC_ELEVENLABS_MODEL || 'fal-ai/elevenlabs/music',
      });
    }

    if (provider === 'minimax') {
      const result = await generateMusicMiniMax(
        prompt,
        { lyricsPrompt: normalizeText(body.lyricsPrompt) },
        { apiKey }
      );

      return NextResponse.json({
        ...result,
        endpoint: result.endpoint || process.env.FAL_MUSIC_MINIMAX_MODEL || 'fal-ai/minimax-music/v2',
      });
    }

    return apiError(API_ERROR_CODES.INVALID_INPUT, `Unsupported music provider: ${provider}`);
  } catch (error) {
    console.error('Generate audio error:', error);
    return apiErrorFromUnknown(error, { message: 'Generate audio failed' });
  }
}
