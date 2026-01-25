import { PromptTemplate, StoryboardGenerationResponse, ProjectReference } from '../types/storyboard';
import { OpenRouterResponse } from '../types/api-responses';
import { buildSystemPrompt } from '../prompts/prompt-builder';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;  // 預設: claude-3.5-sonnet
}

export async function generateStoryboardScript(
  userPrompt: string,
  template: PromptTemplate,
  config: OpenRouterConfig,
  references?: ProjectReference[]
): Promise<StoryboardGenerationResponse> {
  // 使用 prompt builder 構建包含參考圖資訊的系統提示詞
  const systemPrompt = buildSystemPrompt(template, references);

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'X-Title': 'Storyboard System',
    },
    body: JSON.stringify({
      model: config.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet',
      messages: [
        {
          role: 'system',
          content: systemPrompt + '\n\n你必須以 JSON 格式回應，遵循以下結構：' + JSON.stringify(template.outputSchema, null, 2)
        },
        {
          role: 'user',
          content: userPrompt + '\n\n請以 JSON 格式回應，不要包含任何其他文字。'
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  console.log('OpenRouter 回應狀態:', response.status);

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorData = await response.json();
      errorDetails = errorData.error?.message || JSON.stringify(errorData);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(`OpenRouter API error (${response.status}): ${errorDetails}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('OpenRouter 沒有回傳任何內容');
  }

  console.log('收到的回應內容（前 200 字）:', content.substring(0, 200));

  try {
    // 移除可能的 markdown 程式碼區塊標記
    let cleanedContent = content.trim();

    // 如果內容被 ```json 和 ``` 包裹，移除這些標記
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.replace(/^```json\s*/, '');
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.replace(/^```\s*/, '');
    }

    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.replace(/\s*```$/, '');
    }

    return JSON.parse(cleanedContent.trim());
  } catch (error) {
    console.error('JSON 解析失敗，完整內容:', content);
    throw new Error('AI 回傳的內容不是有效的 JSON 格式。請檢查 console 查看完整內容。');
  }
}

/**
 * 分析參考圖片
 */
export async function analyzeReferenceImage(
  base64Image: string,
  prompt: string,
  config: OpenRouterConfig
): Promise<string> {
  const model = process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-001';

  // 處理 base64 圖片格式
  // OpenRouter 預期 URL 格式或 base64 data URI
  // 如果輸入已經是 data URI (data:image/...) 則直接使用，否則加上前綴
  const imageUrl = base64Image.startsWith('data:')
    ? base64Image
    : `data:image/jpeg;base64,${base64Image}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
      'X-Title': 'Storyboard System',
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    let errorDetails = '';
    try {
      const errorData = await response.json();
      errorDetails = errorData.error?.message || JSON.stringify(errorData);
    } catch {
      errorDetails = await response.text();
    }
    throw new Error(`OpenRouter API error (${response.status}): ${errorDetails}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('OpenRouter 沒有回傳任何內容');
  }

  return content;
}
