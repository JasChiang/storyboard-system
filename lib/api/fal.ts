import { fal } from '@fal-ai/client';
import {
  FalQueueResponse,
  FalStatusResponse,
  FalImageResult,
  FalVideoResult,
  FalAudioResult,
} from '../types/api-responses';
import type { IndexTtsEmotionalStrengths, IndexTtsRequestInput } from '../types/audio';

export interface FalConfig {
  apiKey: string;
}

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

// Nano Banana Pro 圖片生成
export async function generateImage(
  prompt: string,
  options: {
    referenceImage?: string | string[];  // base64 或 URL，或者 File 對象 (支援單張或多張)
    aspectRatio?: string;
    resolution?: '1K' | '2K' | '4K';
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  // 從環境變數讀取模型名稱，預設為 nano-banana-pro
  const baseModel = process.env.FAL_IMAGE_MODEL || 'fal-ai/nano-banana-pro';

  // 如果有參考圖，使用 edit endpoint
  const hasReference = options.referenceImage &&
    (Array.isArray(options.referenceImage) ? options.referenceImage.length > 0 : true);

  const endpoint = hasReference
    ? `${baseModel}/edit`
    : baseModel;

  const input: Record<string, unknown> = {
    prompt,
    num_images: 1,
    aspect_ratio: options.aspectRatio || '16:9',
    resolution: options.resolution || '1K',
  };

  if (options.referenceImage) {
    // SDK 會自動處理 File 對象或 URL
    // 支援單張或多張圖片
    input.image_urls = Array.isArray(options.referenceImage)
      ? options.referenceImage
      : [options.referenceImage];
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

// Kling 2.6 Pro 影片生成
export async function generateVideoKling(
  imageUrl: string,
  prompt: string,
  options: {
    duration?: 5 | 10;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    enableSound?: boolean;
    endImageUrl?: string;  // 尾幀圖片 URL
    variant?: 'v26' | 'o3';
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);
  const variant = options.variant || 'v26';

  const resolveKlingEndpoint = (variant: 'v26' | 'o3') => {
    const defaults: Record<'v26' | 'o3', string> = {
      v26: 'fal-ai/kling-video/v2.6/pro/image-to-video',
      o3: 'fal-ai/kling-video/o3/pro/image-to-video',
    };

    const modelsJson = process.env.FAL_VIDEO_KLING_MODELS;
    if (modelsJson) {
      try {
        const parsed = JSON.parse(modelsJson) as Partial<Record<'v26' | 'o3', string>>;
        const configured = parsed?.[variant]?.trim();
        if (configured) return configured;
      } catch (error) {
        console.warn('Invalid FAL_VIDEO_KLING_MODELS JSON, fallback to legacy env/model defaults.', error);
      }
    }

    const legacy = process.env.FAL_VIDEO_KLING_MODEL?.trim();
    if (legacy) return legacy;

    return defaults[variant];
  };

  const endpoint = resolveKlingEndpoint(variant);

  const input: Record<string, string | boolean> = {
    prompt,
    duration: String(options.duration || 5),  // 轉為字串
    generate_audio: options.enableSound ?? false,
    aspect_ratio: options.aspectRatio || '16:9',
  };

  if (variant === 'o3') {
    // Kling O3 官方 schema 主欄位為 image_url
    input.image_url = imageUrl;
  } else {
    // Kling 2.6 使用 start_image_url
    input.start_image_url = imageUrl;
  }

  // 如果提供了尾幀圖片，加入到 input
  if (options.endImageUrl) {
    input.end_image_url = options.endImageUrl;
  }

  console.log('[generateVideoKling] submit:', {
    endpoint,
    variant,
    startKey: variant === 'o3' ? 'image_url' : 'start_image_url',
    hasStartImage: Boolean(variant === 'o3' ? input.image_url : input.start_image_url),
    hasEndImage: Boolean(input.end_image_url),
    aspectRatio: input.aspect_ratio,
    duration: input.duration,
    generateAudio: input.generate_audio,
    promptLength: prompt.length,
  });

  const result = await fal.queue.submit(endpoint, {
    input
  });

  return {
    request_id: result.request_id,
    status: 'IN_QUEUE',
    endpoint,
  };
}

// Seedance 1.5 Pro 影片生成
export async function generateVideoSeedance(
  imageUrl: string,
  prompt: string,
  options: {
    duration?: number;  // 4-12 秒
    aspectRatio?: '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16';
    resolution?: '480p' | '720p' | '1080p';
    enableAudio?: boolean;
    endImageUrl?: string;  // 尾幀圖片 URL
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  const endpoint = process.env.FAL_VIDEO_SEEDANCE_MODEL || 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video';

  const input: Record<string, string | boolean> = {
    image_url: imageUrl,
    prompt,
    duration: String(options.duration || 5),  // API 要求字串格式
    aspect_ratio: options.aspectRatio || '16:9',
    resolution: options.resolution || '720p',
    generate_audio: options.enableAudio ?? false,
  };

  // 如果提供了尾幀圖片，加入到 input
  if (options.endImageUrl) {
    input.end_image_url = options.endImageUrl;
  }

  console.log('[generateVideoSeedance] submit:', {
    endpoint,
    hasImage: Boolean(input.image_url),
    hasEndImage: Boolean(input.end_image_url),
    aspectRatio: input.aspect_ratio,
    resolution: input.resolution,
    duration: input.duration,
    generateAudio: input.generate_audio,
    promptLength: prompt.length,
  });

  const result = await fal.queue.submit(endpoint, {
    input
  });

  return {
    request_id: result.request_id,
    status: 'IN_QUEUE',
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
