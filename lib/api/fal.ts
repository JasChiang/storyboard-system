import {
  FalQueueResponse,
  FalStatusResponse,
  FalImageResult,
  FalVideoResult
} from '../types/api-responses';

const FAL_API_URL = 'https://queue.fal.run';
const FAL_STORAGE_URL = 'https://fal.media/files/upload';

export interface FalConfig {
  apiKey: string;
}

// 上傳文件到 Fal Storage
export async function uploadFile(
  file: File,
  config: FalConfig
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(FAL_STORAGE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Upload failed:', response.status, errorText);
    throw new Error(`Fal upload error (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log('Upload result:', result);

  // Fal Storage 返回格式: { file_url: "https://..." }
  return result.file_url || result.url;
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
    // /edit endpoint 需要 image_urls (複數，陣列格式)
    payload.image_urls = [options.referenceImage];
  }

  console.log('Generating image with endpoint:', endpoint);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${FAL_API_URL}/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Generate image failed:', response.status, errorText);
    throw new Error(`Fal API error (${response.status}): ${errorText}`);
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
  const url = `${FAL_API_URL}/${endpoint}/requests/${requestId}/status`;
  console.log('Checking status at:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Status check failed:', response.status, errorText);
    throw new Error(`Fal API error: ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  console.log('Status response:', JSON.stringify(result, null, 2));
  return result;
}

// 獲取結果
export async function getImageResult(
  requestId: string,
  endpoint: string,
  config: FalConfig
): Promise<FalImageResult> {
  const response = await fetch(`${FAL_API_URL}/${endpoint}/requests/${requestId}`, {
    method: 'GET',
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
    method: 'GET',
    headers: {
      'Authorization': `Key ${config.apiKey}`,
    }
  });

  if (!response.ok) {
    throw new Error(`Fal API error: ${await response.text()}`);
  }

  return response.json();
}
