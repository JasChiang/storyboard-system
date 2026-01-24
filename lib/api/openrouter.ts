import { PromptTemplate, StoryboardGenerationResponse } from '../types/storyboard';
import { OpenRouterResponse } from '../types/api-responses';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export interface OpenRouterConfig {
  apiKey: string;
  model?: string;  // 預設: claude-3.5-sonnet
}

export async function generateStoryboardScript(
  userPrompt: string,
  template: PromptTemplate,
  config: OpenRouterConfig
): Promise<StoryboardGenerationResponse> {
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
          content: template.systemPrompt + '\n\n你必須以 JSON 格式回應，遵循以下結構：' + JSON.stringify(template.outputSchema, null, 2)
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
