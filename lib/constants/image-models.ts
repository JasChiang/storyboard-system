export type ImageGenerationModel = 'nano-banana-pro' | 'seedream-5-lite';

export const IMAGE_GENERATION_MODEL_ENDPOINTS: Record<ImageGenerationModel, string> = {
  'nano-banana-pro': 'fal-ai/nano-banana-pro',
  'seedream-5-lite': 'fal-ai/bytedance/seedream/v5/lite/text-to-image',
};

export const IMAGE_GENERATION_MODEL_LABELS: Record<ImageGenerationModel, string> = {
  'nano-banana-pro': 'Nano Banana Pro',
  'seedream-5-lite': 'Seedream 5.0 Lite',
};

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
