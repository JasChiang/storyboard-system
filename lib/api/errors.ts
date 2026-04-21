import { NextResponse } from 'next/server';

/**
 * Structured API errors shared by all route handlers.
 *
 * Frontend can branch on `code` (stable machine-readable) instead of parsing
 * `message` (human copy that may change). Always include a correlation id so
 * individual failures can be traced across logs.
 */

export const API_ERROR_CODES = {
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  SERVER_MISCONFIGURED: 'SERVER_MISCONFIGURED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface ApiErrorPayload {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
    correlationId: string;
  };
}

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const CODE_TO_HTTP_STATUS: Record<ApiErrorCode, number> = {
  INVALID_INPUT: 400,
  MISSING_FIELD: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  UPSTREAM_ERROR: 502,
  UPSTREAM_TIMEOUT: 504,
  SERVER_MISCONFIGURED: 500,
  INTERNAL_ERROR: 500,
};

export function apiError(
  code: ApiErrorCode,
  message: string,
  options: { details?: unknown; status?: number } = {}
): NextResponse<ApiErrorPayload> {
  const correlationId = generateCorrelationId();
  const payload: ApiErrorPayload = {
    error: {
      code,
      message,
      correlationId,
      ...(options.details !== undefined ? { details: options.details } : {}),
    },
  };
  const status = options.status ?? CODE_TO_HTTP_STATUS[code];
  console.warn(`[API_ERROR] ${JSON.stringify({ code, message, correlationId, status })}`);
  return NextResponse.json(payload, { status });
}

/**
 * Map an unknown error (usually a thrown Error from downstream code) into a
 * sensible ApiError response. Hides internals by default; pass `exposeMessage`
 * only when the message is safe to surface to clients.
 */
export function apiErrorFromUnknown(
  error: unknown,
  fallback: { code?: ApiErrorCode; message?: string; exposeMessage?: boolean } = {}
): NextResponse<ApiErrorPayload> {
  const raw = error instanceof Error ? error.message : 'Unknown error';
  const isQuota = /quota|429/i.test(raw);
  const isTimeout = /timeout|timed out|504/i.test(raw);
  const isUpstream = /openrouter|gemini|fal\.|upstream|502|503/i.test(raw);

  if (isQuota) return apiError(API_ERROR_CODES.QUOTA_EXCEEDED, raw);
  if (isTimeout) return apiError(API_ERROR_CODES.UPSTREAM_TIMEOUT, raw);
  if (isUpstream) return apiError(API_ERROR_CODES.UPSTREAM_ERROR, raw);

  return apiError(
    fallback.code ?? API_ERROR_CODES.INTERNAL_ERROR,
    fallback.exposeMessage ? raw : (fallback.message ?? '伺服器內部錯誤'),
    { details: process.env.NODE_ENV === 'development' ? { raw } : undefined }
  );
}
