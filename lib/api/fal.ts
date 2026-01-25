import { fal } from '@fal-ai/client';
import {
  FalQueueResponse,
  FalStatusResponse,
  FalImageResult,
  FalVideoResult
} from '../types/api-responses';

export interface FalConfig {
  apiKey: string;
}

// 設定 Fal SDK
function configureFal(apiKey: string) {
  fal.config({
    credentials: apiKey,
  });
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
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  const endpoint = process.env.FAL_VIDEO_KLING_MODEL || 'fal-ai/kling-video/v2.6/pro/image-to-video';

  const result = await fal.queue.submit(endpoint, {
    input: {
      image_url: imageUrl,
      prompt,
      duration: options.duration || 5,
      aspect_ratio: options.aspectRatio || '16:9',
      generate_audio: options.enableSound ?? false,
    }
  });

  return {
    request_id: result.request_id,
    status: 'IN_QUEUE',
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
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  configureFal(config.apiKey);

  const endpoint = process.env.FAL_VIDEO_SEEDANCE_MODEL || 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video';

  const result = await fal.queue.submit(endpoint, {
    input: {
      image_url: imageUrl,
      prompt,
      duration: String(options.duration || 5),  // API 要求字串格式
      aspect_ratio: options.aspectRatio || '16:9',
      resolution: options.resolution || '720p',
      generate_audio: options.enableAudio ?? false,
    }
  });

  return {
    request_id: result.request_id,
    status: 'IN_QUEUE',
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
    const status: any = await fal.queue.status(endpoint, {
      requestId,
      logs: true,
    });

    console.log('Status response:', JSON.stringify(status, null, 2));

    return {
      status: status.status as 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
      response_url: status.response_url,
      logs: status.logs?.map((log: any) => log.message),
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
