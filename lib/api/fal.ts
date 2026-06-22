import { fal } from '@fal-ai/client';
import {
  FalQueueResponse,
  FalStatusResponse,
  FalImageResult,
  FalVideoResult,
  FalAudioResult,
} from '../types/api-responses';
import type { IndexTtsEmotionalStrengths, IndexTtsRequestInput } from '../types/audio';
import {
  isGptImage2Endpoint,
  resolveImageModelEndpoint,
  type GptImage2Quality,
} from '../constants/image-models';

export interface FalConfig {
  apiKey: string;
}

type ImageResolution = '1K' | '2K' | '4K';
type ImageAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

type FalQueueLog = {
  message?: string;
};

type FalQueueStatusResponse = {
  status?: string;
  response_url?: string;
  logs?: FalQueueLog[];
  error?: string;
  metrics?: Record<string, unknown>;
};

// 設定 Fal SDK
function configureFal(apiKey: string) {
  fal.config({
    credentials: apiKey,
  });
}

async function submitWithInputVariants(
  endpoint: string,
  inputVariants: Array<Record<string, unknown>>
) {
  let lastError: unknown;
  for (const input of inputVariants) {
    try {
      const result = await fal.queue.submit(endpoint, { input });
      return result;
    } catch (error) {
      lastError = error;
      console.warn('[fal] submit variant failed, trying next variant', {
        endpoint,
        keys: Object.keys(input),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Fal submit failed for all input variants');
}

const INDEX_TTS_EMOTION_ALIASES: Record<
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

function normalizeIndexTtsEmotionalStrengths(value: unknown): IndexTtsEmotionalStrengths | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const normalized: IndexTtsEmotionalStrengths = {};

  for (const [canonicalKey, aliases] of Object.entries(INDEX_TTS_EMOTION_ALIASES) as Array<[keyof typeof INDEX_TTS_EMOTION_ALIASES, string[]]>) {
    const n = aliases
      .map((alias) => Number(raw[alias]))
      .find((num) => Number.isFinite(num));
    if (typeof n === 'number') {
      normalized[canonicalKey] = Math.max(0, Math.min(1, n));
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

// 上傳文件到 Fal Storage（SDK 會自動處理）
export async function uploadFile(
  file: File,
  config: FalConfig
): Promise<string> {
  configureFal(config.apiKey);

  // Fal SDK 會自動上傳文件並返回 URL
  const url = await fal.storage.upload(file);
  console.log('Upload result:', url);

  return url;
}

// 圖片生成（預設走 gpt-image-2，仍相容 nano-banana-pro / seedream）
export async function generateImage(
  prompt: string,
  options: {
    referenceImage?: string | string[];  // base64 或 URL，或者 File 對象 (支援單張或多張)
    aspectRatio?: string;
    resolution?: ImageResolution;
    modelEndpoint?: string;
    seed?: number;
    quality?: GptImage2Quality;   // gpt-image-2 only
    maskImageUrl?: string;         // gpt-image-2 edit only
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  const baseModel = options.modelEndpoint || process.env.FAL_IMAGE_MODEL || 'openai/gpt-image-2';

  const hasReference = options.referenceImage &&
    (Array.isArray(options.referenceImage) ? options.referenceImage.length > 0 : true);

  const { endpoint, isEditOnlyEndpoint } = resolveImageModelEndpoint(baseModel, Boolean(hasReference));
  if (isEditOnlyEndpoint && !hasReference) {
    throw new Error('Selected image model requires at least one reference image');
  }

  const input: Record<string, unknown> = {
    prompt,
    num_images: 1,
  };

  const isSeedream = endpoint.includes('/seedream/');
  const isGptImage2 = isGptImage2Endpoint(endpoint);

  if (isSeedream) {
    const aspectRatio = (options.aspectRatio || '16:9') as ImageAspectRatio;
    const resolution = options.resolution || '1K';
    input.image_size = toSeedreamImageSize(aspectRatio, resolution);
  } else if (isGptImage2) {
    // gpt-image-2 uses image_size ({width,height} multiples of 16, long edge <3840)
    input.image_size = toGptImage2ImageSize(
      (options.aspectRatio || '16:9') as ImageAspectRatio,
      options.resolution || '2K',
    );
    input.quality = options.quality || 'high';
    input.output_format = 'png';
    if (options.maskImageUrl) {
      input.mask_image_url = options.maskImageUrl;
    }
  } else {
    input.aspect_ratio = options.aspectRatio || '16:9';
    input.resolution = options.resolution || '1K';
  }

  if (options.referenceImage) {
    // SDK 會自動處理 File 對象或 URL
    // 支援單張或多張圖片
    input.image_urls = Array.isArray(options.referenceImage)
      ? options.referenceImage
      : [options.referenceImage];
  }

  if (typeof options.seed === 'number' && Number.isFinite(options.seed) && !isGptImage2) {
    // gpt-image-2 does not expose a seed parameter on fal
    input.seed = Math.trunc(options.seed);
  }

  console.log('Generating image with endpoint:', endpoint);
  console.log('Input:', JSON.stringify(input, null, 2));

  try {
    // 使用 SDK 提交請求
    const result = await fal.queue.submit(endpoint, {
      input,
    });

    console.log('Queue submit result:', result);

    return {
      request_id: result.request_id,
      status: 'IN_QUEUE',
    };
  } catch (error) {
    console.error('Generate image failed:', error);
    throw error;
  }
}

function toSeedreamImageSize(
  aspectRatio: ImageAspectRatio,
  resolution: ImageResolution
): string {
  if (resolution === '4K') {
    return 'auto_3K';
  }

  const byAspect: Record<ImageAspectRatio, string> = {
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
    '1:1': 'square_hd',
    '4:3': 'landscape_4_3',
    '3:4': 'portrait_4_3',
  };

  return byAspect[aspectRatio];
}

// gpt-image-2 requires {width, height}, both multiples of 16, long edge <3840,
// aspect ratio ≤3:1. We derive dims from the UI's aspectRatio + resolution.
function toGptImage2ImageSize(
  aspectRatio: ImageAspectRatio,
  resolution: ImageResolution,
): { width: number; height: number } {
  const longEdge = resolution === '1K' ? 1024 : resolution === '2K' ? 2048 : 3840;
  const [aRaw, bRaw] = aspectRatio.split(':').map((n) => Number(n));
  const a = Number.isFinite(aRaw) && aRaw > 0 ? aRaw : 16;
  const b = Number.isFinite(bRaw) && bRaw > 0 ? bRaw : 9;
  const longDim = a >= b ? a : b;
  const shortDim = a >= b ? b : a;
  const shortEdge = Math.max(16, Math.round((longEdge * shortDim) / longDim / 16) * 16);
  return a >= b
    ? { width: longEdge, height: shortEdge }
    : { width: shortEdge, height: longEdge };
}

export type SeedanceVariant =
  | 'v20_i2v'
  | 'v20_i2v_fast'
  | 'v20_ref'
  | 'v20_ref_fast'
  | 'v20_t2v'
  | 'v20_t2v_fast';

export const SEEDANCE_I2V_VARIANTS: readonly SeedanceVariant[] = ['v20_i2v', 'v20_i2v_fast'] as const;
export const SEEDANCE_REF_VARIANTS: readonly SeedanceVariant[] = ['v20_ref', 'v20_ref_fast'] as const;
export const SEEDANCE_T2V_VARIANTS: readonly SeedanceVariant[] = ['v20_t2v', 'v20_t2v_fast'] as const;
export const SEEDANCE_FAST_VARIANTS: readonly SeedanceVariant[] = ['v20_i2v_fast', 'v20_ref_fast', 'v20_t2v_fast'] as const;

const SEEDANCE_ENDPOINT_DEFAULTS: Record<SeedanceVariant, string> = {
  v20_i2v: 'bytedance/seedance-2.0/image-to-video',
  v20_i2v_fast: 'bytedance/seedance-2.0/fast/image-to-video',
  v20_ref: 'bytedance/seedance-2.0/reference-to-video',
  v20_ref_fast: 'bytedance/seedance-2.0/fast/reference-to-video',
  v20_t2v: 'bytedance/seedance-2.0/text-to-video',
  v20_t2v_fast: 'bytedance/seedance-2.0/fast/text-to-video',
};

function resolveSeedanceEndpoint(variant: SeedanceVariant): string {
  const modelsJson = process.env.FAL_VIDEO_SEEDANCE_MODELS;
  if (modelsJson) {
    try {
      const parsed = JSON.parse(modelsJson) as Partial<Record<SeedanceVariant, string>>;
      const configured = parsed?.[variant]?.trim();
      if (configured) return configured;
    } catch (error) {
      console.warn('Invalid FAL_VIDEO_SEEDANCE_MODELS JSON, fallback to defaults.', error);
    }
  }
  return SEEDANCE_ENDPOINT_DEFAULTS[variant];
}

// Seedance 2.0 — supports image-to-video / reference-to-video / text-to-video, each with a fast variant.
export async function generateVideoSeedance(
  imageUrl: string | null | undefined,
  prompt: string,
  options: {
    duration?: number;
    aspectRatio?: 'auto' | '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
    resolution?: '480p' | '720p' | '1080p';
    enableAudio?: boolean;
    endImageUrl?: string;
    variant?: SeedanceVariant;
    referenceImageUrls?: string[];
    referenceVideoUrls?: string[];
    referenceAudioUrls?: string[];
    seed?: number;
    endUserId?: string;
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  const variant: SeedanceVariant = options.variant || 'v20_i2v';
  const endpoint = resolveSeedanceEndpoint(variant);
  const isReference = SEEDANCE_REF_VARIANTS.includes(variant);
  const isText = SEEDANCE_T2V_VARIANTS.includes(variant);
  const isImage = SEEDANCE_I2V_VARIANTS.includes(variant);
  const isFast = SEEDANCE_FAST_VARIANTS.includes(variant);

  // Fast variants cap at 720p (no 1080p). Silently downgrade rather than error.
  const resolution = isFast && options.resolution === '1080p' ? '720p' : (options.resolution || '720p');

  const input: Record<string, unknown> = {
    prompt,
    duration: options.duration == null ? 'auto' : String(options.duration),
    aspect_ratio: options.aspectRatio || 'auto',
    resolution,
    generate_audio: options.enableAudio ?? false,
  };
  if (typeof options.seed === 'number') input.seed = options.seed;
  if (options.endUserId) input.end_user_id = options.endUserId;

  if (isReference) {
    const imgs = (options.referenceImageUrls || []).filter(Boolean).slice(0, 9);
    const vids = (options.referenceVideoUrls || []).filter(Boolean).slice(0, 3);
    const auds = (options.referenceAudioUrls || []).filter(Boolean).slice(0, 3);
    if (imgs.length === 0 && vids.length === 0 && auds.length === 0) {
      throw new Error('Seedance reference-to-video requires at least one image, video, or audio reference URL');
    }
    if (imgs.length) input.image_urls = imgs;
    if (vids.length) input.video_urls = vids;
    if (auds.length) input.audio_urls = auds;
  } else if (isImage) {
    if (!imageUrl) {
      throw new Error('Seedance image-to-video requires start image URL');
    }
    input.image_url = imageUrl;
    if (options.endImageUrl) input.end_image_url = options.endImageUrl;
  } else if (isText) {
    // t2v — prompt-only, no media inputs
  }

  console.log('[generateVideoSeedance] submit:', {
    endpoint,
    variant,
    mode: isReference ? 'ref' : isText ? 't2v' : 'i2v',
    fast: isFast,
    referenceCounts: isReference ? {
      images: (input.image_urls as string[] | undefined)?.length ?? 0,
      videos: (input.video_urls as string[] | undefined)?.length ?? 0,
      audios: (input.audio_urls as string[] | undefined)?.length ?? 0,
    } : undefined,
    hasImage: Boolean(input.image_url),
    hasEndImage: Boolean(input.end_image_url),
    aspectRatio: input.aspect_ratio,
    resolution: input.resolution,
    duration: input.duration,
    generateAudio: input.generate_audio,
    promptLength: prompt.length,
  });

  const result = await fal.queue.submit(endpoint, { input });

  return {
    request_id: result.request_id,
    status: 'IN_QUEUE',
    endpoint,
  };
}

export async function generateMusicElevenLabs(
  prompt: string,
  options: {
    durationMs?: number;
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  const endpoint = process.env.FAL_MUSIC_ELEVENLABS_MODEL || 'fal-ai/elevenlabs/music';
  const normalizedDurationMs = Number.isFinite(Number(options.durationMs))
    ? Math.max(3000, Math.min(600000, Math.round(Number(options.durationMs))))
    : undefined;

  const input: Record<string, unknown> = { prompt };
  if (typeof normalizedDurationMs === 'number') {
    input.music_length_ms = normalizedDurationMs;
  }

  console.log('[generateMusicElevenLabs] submit:', {
    endpoint,
    promptLength: prompt.length,
    durationMs: normalizedDurationMs,
  });

  const result = await fal.queue.submit(endpoint, { input });
  return {
    request_id: result.request_id,
    status: 'IN_QUEUE',
    endpoint,
  };
}

export async function generateMusicMiniMax(
  prompt: string,
  options: {
    lyricsPrompt?: string;
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  const endpoint = process.env.FAL_MUSIC_MINIMAX_MODEL || 'fal-ai/minimax-music/v2';
  const lyricsPrompt = options.lyricsPrompt?.trim();
  const primaryInput: Record<string, unknown> = {
    prompt,
  };
  if (lyricsPrompt) {
    primaryInput.lyrics_prompt = lyricsPrompt;
  }
  const fallbackInput: Record<string, unknown> = {
    prompt,
  };
  if (lyricsPrompt) {
    fallbackInput.lyrics = lyricsPrompt;
  }

  console.log('[generateMusicMiniMax] submit:', {
    endpoint,
    promptLength: prompt.length,
    hasLyricsPrompt: Boolean(lyricsPrompt),
  });

  const result = await submitWithInputVariants(endpoint, [primaryInput, fallbackInput]);
  return {
    request_id: result.request_id,
    status: 'IN_QUEUE',
    endpoint,
  };
}

export async function generateVoiceoverIndexTts(
  input: IndexTtsRequestInput,
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  const endpoint = process.env.FAL_TTS_INDEX_MODEL || 'fal-ai/index-tts-2/text-to-speech';
  const normalizedInput: IndexTtsRequestInput = {
    audio_url: input.audio_url.trim(),
    prompt: input.prompt.trim(),
    emotional_audio_url: input.emotional_audio_url?.trim() || undefined,
    strength: typeof input.strength === 'number'
      ? Math.max(0, Math.min(1, input.strength))
      : undefined,
    emotional_strengths: normalizeIndexTtsEmotionalStrengths(input.emotional_strengths),
    should_use_prompt_for_emotion: input.should_use_prompt_for_emotion,
    emotion_prompt: input.emotion_prompt?.trim() || undefined,
  };

  if (!normalizedInput.audio_url) {
    throw new Error('Index TTS requires audio_url');
  }
  if (!normalizedInput.prompt) {
    throw new Error('Index TTS requires prompt');
  }
  if (normalizedInput.emotion_prompt && normalizedInput.should_use_prompt_for_emotion !== true) {
    normalizedInput.should_use_prompt_for_emotion = true;
  }

  console.log('[generateVoiceoverIndexTts] submit:', {
    endpoint,
    promptLength: normalizedInput.prompt.length,
    hasAudioUrl: Boolean(normalizedInput.audio_url),
    hasEmotionalAudioUrl: Boolean(normalizedInput.emotional_audio_url),
    hasEmotionalStrengths: Boolean(normalizedInput.emotional_strengths),
    strength: normalizedInput.strength,
    useEmotionPrompt: normalizedInput.should_use_prompt_for_emotion,
    hasEmotionPrompt: Boolean(normalizedInput.emotion_prompt),
  });

  const submitInput: Record<string, unknown> = { ...normalizedInput };
  const result = await submitWithInputVariants(endpoint, [submitInput]);
  return {
    request_id: result.request_id,
    status: 'IN_QUEUE',
    endpoint,
  };
}

// 檢查任務狀態
export async function checkQueueStatus(
  requestId: string,
  endpoint: string,
  config: FalConfig
): Promise<FalStatusResponse> {
  configureFal(config.apiKey);

  console.log('Checking status for:', requestId, 'on endpoint:', endpoint);

  try {
    const status = (await fal.queue.status(endpoint, {
      requestId,
      logs: true,
    })) as FalQueueStatusResponse;

    console.log('Status response:', JSON.stringify(status, null, 2));

    return {
      status: status.status as 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
      response_url: status.response_url,
      logs: status.logs?.map((log) => log.message).filter((msg): msg is string => msg !== undefined),
      error: status.error,
      metrics: status.metrics,
    };
  } catch (error) {
    console.error('Status check failed:', error);
    throw error;
  }
}

// 取得圖片結果
export async function getImageResult(
  requestId: string,
  endpoint: string,
  config: FalConfig
): Promise<FalImageResult> {
  configureFal(config.apiKey);

  console.log('Getting result for:', requestId, 'on endpoint:', endpoint);

  try {
    const result = await fal.queue.result(endpoint, {
      requestId,
    });

    console.log('Result data:', JSON.stringify(result, null, 2));

    return result.data as FalImageResult;
  } catch (error) {
    console.error('Get result failed:', error);
    throw error;
  }
}

// 取得影片結果
export async function getVideoResult(
  requestId: string,
  endpoint: string,
  config: FalConfig
): Promise<FalVideoResult> {
  configureFal(config.apiKey);

  const result = await fal.queue.result(endpoint, {
    requestId,
  });

  return result.data as FalVideoResult;
}

// 取得音訊結果
export async function getAudioResult(
  requestId: string,
  endpoint: string,
  config: FalConfig
): Promise<FalAudioResult> {
  configureFal(config.apiKey);

  const result = await fal.queue.result(endpoint, {
    requestId,
  });

  return result.data as FalAudioResult;
}
