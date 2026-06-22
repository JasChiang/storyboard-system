export type ImageGenerationModel = 'gpt-image-2' | 'nano-banana-pro' | 'seedream-5-lite';

export const IMAGE_GENERATION_MODEL_ENDPOINTS: Record<ImageGenerationModel, string> = {
  'gpt-image-2': 'openai/gpt-image-2',
  'nano-banana-pro': 'fal-ai/nano-banana-pro',
  'seedream-5-lite': 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
};

export const IMAGE_GENERATION_MODEL_LABELS: Record<ImageGenerationModel, string> = {
  'gpt-image-2': 'GPT Image 2 (OpenAI)',
  'nano-banana-pro': 'Nano Banana Pro',
  'seedream-5-lite': 'Seedream 5.0 Lite',
};

// UI-visible models. Nano Banana Pro is intentionally hidden from selectors per
// the OpenAI Cookbook-based refactor; existing scenes persisted with that model
// still validate because the enum/endpoints above remain intact.
export const VISIBLE_IMAGE_MODELS: ImageGenerationModel[] = [
  'gpt-image-2',
  'seedream-5-lite',
];

export const DEFAULT_IMAGE_MODEL: ImageGenerationModel = 'gpt-image-2';

export type GptImage2Quality = 'low' | 'medium' | 'high';
export const GPT_IMAGE_2_DEFAULT_QUALITY: GptImage2Quality = 'high';

export function isGptImage2Endpoint(endpoint: string): boolean {
  return endpoint.startsWith('openai/gpt-image-2');
}

export function resolveImageModelEndpoint(baseModel: string, hasReference: boolean): {
  endpoint: string;
  isEditOnlyEndpoint: boolean;
} {
  if (baseModel.endsWith('/edit')) {
    return {
      endpoint: baseModel,
      isEditOnlyEndpoint: true,
    };
  }

  if (baseModel.endsWith('/text-to-image')) {
    return {
      endpoint: hasReference ? baseModel.replace('/text-to-image', '/edit') : baseModel,
      isEditOnlyEndpoint: false,
    };
  }

  return {
    endpoint: hasReference ? `${baseModel}/edit` : baseModel,
    isEditOnlyEndpoint: false,
  };
}
