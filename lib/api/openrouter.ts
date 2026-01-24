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
        { role: 'system', content: template.systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'storyboard_output',
          strict: true,
          schema: template.outputSchema
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenRouter');
  }

  return JSON.parse(content);
}
