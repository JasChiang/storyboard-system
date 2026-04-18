/**
 * Domain-grouped API helpers. Each group wraps the unified apiClient with
 * a typed surface so components no longer spell out URLs and bodies.
 *
 * Add new calls here instead of inline `fetch()` in components.
 */
import { apiClient } from './client';

export const falApi = {
  generateImage: <T = unknown>(body: unknown, init?: { signal?: AbortSignal }) =>
    apiClient.post<T>('/api/fal/generate-image', body, { timeoutMs: 180_000, ...init }),

  generateVideo: <T = unknown>(body: unknown, init?: { signal?: AbortSignal }) =>
    apiClient.post<T>('/api/fal/generate-video', body, { timeoutMs: 300_000, ...init }),

  generateAudio: <T = unknown>(body: unknown, init?: { signal?: AbortSignal }) =>
    apiClient.post<T>('/api/fal/generate-audio', body, { timeoutMs: 180_000, ...init }),

  checkStatus: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/fal/check-status', body, { timeoutMs: 30_000 }),

  proxy: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/fal/proxy', body, { timeoutMs: 60_000 }),
};

export const geminiApi = {
  analyzeReference: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/gemini/analyze-reference', body, { timeoutMs: 120_000 }),

  analyzeVideos: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/gemini/analyze-videos', body, { timeoutMs: 300_000 }),

  composeImagePrompt: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/gemini/compose-image-prompt', body, { timeoutMs: 60_000 }),

  composeVideoPrompt: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/gemini/compose-video-prompt', body, { timeoutMs: 60_000 }),

  uploadVideo: <T = unknown>(body: FormData) =>
    apiClient.post<T>('/api/gemini/upload-video', body, { timeoutMs: 300_000 }),
};

export const openrouterApi = {
  generateStoryboard: <T = unknown>(body: unknown, init?: { signal?: AbortSignal }) =>
    apiClient.post<T>('/api/openrouter/generate-storyboard', body, { timeoutMs: 180_000, ...init }),

  regenerateScene: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/openrouter/regenerate-scene', body, { timeoutMs: 60_000 }),

  generateVoiceoverParams: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/openrouter/generate-voiceover-params', body, { timeoutMs: 60_000 }),
};

export const projectsApi = {
  list: <T = unknown>() => apiClient.get<T>('/api/data/projects'),
  get: <T = unknown>(id: string) => apiClient.get<T>(`/api/data/projects/${id}`),
  create: <T = unknown>(body: unknown) => apiClient.post<T>('/api/data/projects', body),
  update: <T = unknown>(id: string, body: unknown) =>
    apiClient.put<T>(`/api/data/projects/${id}`, body),
  remove: <T = unknown>(id: string) => apiClient.delete<T>(`/api/data/projects/${id}`),
  import: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/data/projects/import', body),
};

export const characterLibraryApi = {
  list: <T = unknown>() => apiClient.get<T>('/api/data/character-library'),
  get: <T = unknown>(id: string) => apiClient.get<T>(`/api/data/character-library/${id}`),
  create: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/data/character-library', body),
  update: <T = unknown>(id: string, body: unknown) =>
    apiClient.put<T>(`/api/data/character-library/${id}`, body),
  remove: <T = unknown>(id: string) =>
    apiClient.delete<T>(`/api/data/character-library/${id}`),
  incrementUsage: <T = unknown>(id: string) =>
    apiClient.post<T>(`/api/data/character-library/${id}/increment-usage`),
  autoGenerate: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/data/character-library/auto-generate', body, { timeoutMs: 180_000 }),
  import: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/data/character-library/import', body),
};

export const workflowApi = {
  runs: <T = unknown>() => apiClient.get<T>('/api/workflow/runs'),
  validateStoryboard: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/workflow/qa/validate-storyboard', body),
  autoFix: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/workflow/qa/auto-fix', body),
};

export const ffmpegApi = {
  render: <T = unknown>(body: unknown, init?: { signal?: AbortSignal }) =>
    apiClient.post<T>('/api/ffmpeg/render', body, { timeoutMs: 600_000, ...init }),
};

export const mediaApi = {
  describeImage: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/describe-image', body, { timeoutMs: 60_000 }),
  localMedia: <T = unknown>(body: unknown) =>
    apiClient.post<T>('/api/local-media', body),
};
