/**
 * Structured token/cost logging for LLM API calls.
 *
 * Emits a single JSON line per call so any log aggregator (Vercel, Datadog,
 * CloudWatch) can pick it up without extra instrumentation. Prices are USD per
 * 1M tokens and reflect published list prices at time of writing — they are a
 * rough-cost signal, not an authoritative billing source.
 */

interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  'anthropic/claude-3.5-sonnet': { inputPer1M: 3, outputPer1M: 15 },
  'anthropic/claude-3-5-sonnet': { inputPer1M: 3, outputPer1M: 15 },
  'anthropic/claude-sonnet-4.6': { inputPer1M: 3, outputPer1M: 15 },
  'anthropic/claude-opus-4': { inputPer1M: 15, outputPer1M: 75 },
  'google/gemini-2.0-flash': { inputPer1M: 0.1, outputPer1M: 0.4 },
  'google/gemini-2.5-flash': { inputPer1M: 0.3, outputPer1M: 2.5 },
};

export interface LlmUsageRecord {
  provider: 'openrouter' | 'gemini';
  model: string;
  purpose: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const cost = (promptTokens * pricing.inputPer1M + completionTokens * pricing.outputPer1M) / 1_000_000;
  return Number(cost.toFixed(6));
}

export function logLlmUsage(record: LlmUsageRecord): void {
  console.log(`[LLM_USAGE] ${JSON.stringify(record)}`);
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

/**
 * Instrument a Gemini generateContent call so every invocation produces a
 * structured [LLM_USAGE] log line.
 */
export async function withGeminiUsageLogging<T extends { usageMetadata?: GeminiUsageMetadata }>(
  params: { model: string; purpose: string },
  operation: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await operation();
    const promptTokens = result.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = result.usageMetadata?.candidatesTokenCount ?? 0;
    const totalTokens = result.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens;
    logLlmUsage({
      provider: 'gemini',
      model: params.model,
      purpose: params.purpose,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: estimateCostUsd(params.model, promptTokens, completionTokens),
      durationMs: Date.now() - startedAt,
      success: true,
    });
    return result;
  } catch (error) {
    logLlmUsage({
      provider: 'gemini',
      model: params.model,
      purpose: params.purpose,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'unknown error',
    });
    throw error;
  }
}
