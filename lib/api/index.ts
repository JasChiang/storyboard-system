/**
 * Central barrel for the API layer.
 *
 * Client components should import from here instead of calling fetch() directly.
 *   import { falApi, geminiApi, ApiError } from '@/lib/api';
 *
 * Server-side Fal/Gemini/OpenRouter SDK wrappers remain in their own files
 * (`fal.ts`, `gemini.ts`, `openrouter.ts`) and are used inside route handlers.
 */
export { apiClient, ApiError, isApiError, type ApiRequestOptions } from './client';
export * from './services';
