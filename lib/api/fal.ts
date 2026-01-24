import {
  FalQueueResponse,
  FalStatusResponse,
  FalImageResult,
  FalVideoResult
} from '../types/api-responses';

const FAL_API_URL = 'https://queue.fal.run';

export interface FalConfig {
  apiKey: string;
}

// Nano Banana Pro 圖片生成
export async function generateImage(
  prompt: string,
  options: {
    referenceImage?: string;  // base64 或 URL
    aspectRatio?: string;
    resolution?: '1K' | '2K' | '4K';
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  // 從環境變數讀取模型名稱，預設為 nano-banana-pro
  const baseModel = process.env.FAL_IMAGE_MODEL || 'fal-ai/nano-banana-pro';

  // 如果有參考圖，使用 edit endpoint
  const endpoint = options.referenceImage
    ? `${baseModel}/edit`
    : baseModel;

  const payload: Record<string, unknown> = {
    prompt,
    num_images: 1,
    aspect_ratio: options.aspectRatio || '16:9',
    resolution: options.resolution || '1K',
  };

  if (options.referenceImage) {
    payload.image_url = options.referenceImage;
  }

  const response = await fetch(`${FAL_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Fal API error: ${await response.text()}`);
  }

  return response.json();
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
  const endpoint = process.env.FAL_VIDEO_KLING_MODEL || 'fal-ai/kling-video/v2.6/pro/image-to-video';

  const response = await fetch(`${FAL_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      duration: options.duration || 5,
      aspect_ratio: options.aspectRatio || '16:9',
      sound: options.enableSound || false,
    })
  });

  if (!response.ok) {
    throw new Error(`Fal API error: ${await response.text()}`);
  }

  return response.json();
}

// Seedance 1.5 Pro 影片生成
export async function generateVideoSeedance(
  imageUrl: string,
  prompt: string,
  options: {
    duration?: number;  // 4-12 秒
    enableAudio?: boolean;
  },
  config: FalConfig
): Promise<FalQueueResponse> {
  const endpoint = process.env.FAL_VIDEO_SEEDANCE_MODEL || 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video';

  const response = await fetch(`${FAL_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      duration: options.duration || 5,
      audio: options.enableAudio || false,
    })
  });

  if (!response.ok) {
    throw new Error(`Fal API error: ${await response.text()}`);
  }

  return response.json();
}

// 檢查任務狀態
export async function checkQueueStatus(
  requestId: string,
  endpoint: string,
  config: FalConfig
): Promise<FalStatusResponse> {
  const response = await fetch(`${FAL_API_URL}/${endpoint}/requests/${requestId}/status`, {
    headers: {
      'Authorization': `Key ${config.apiKey}`,
    }
  });

  if (!response.ok) {
    throw new Error(`Fal API error: ${await response.text()}`);
  }

  return response.json();
}

// 獲取結果
export async function getImageResult(
  requestId: string,
  endpoint: string,
  config: FalConfig
): Promise<FalImageResult> {
  const response = await fetch(`${FAL_API_URL}/${endpoint}/requests/${requestId}`, {
    headers: {
      'Authorization': `Key ${config.apiKey}`,
    }
  });

  if (!response.ok) {
    throw new Error(`Fal API error: ${await response.text()}`);
  }

  return response.json();
}

export async function getVideoResult(
  requestId: string,
  endpoint: string,
  config: FalConfig
): Promise<FalVideoResult> {
  const response = await fetch(`${FAL_API_URL}/${endpoint}/requests/${requestId}`, {
    headers: {
      'Authorization': `Key ${config.apiKey}`,
    }
  });

  if (!response.ok) {
    throw new Error(`Fal API error: ${await response.text()}`);
  }

  return response.json();
}
