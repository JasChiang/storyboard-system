/**
 * Unified API client for internal Next.js route handlers.
 *
 * Goals:
 * - Single place to configure base URL, headers, JSON handling.
 * - Consistent error shape (ApiError) with HTTP status + parsed body.
 * - Built-in timeout, abort signal, optional retry with exponential backoff
 *   for idempotent GET requests.
 * - Zero external deps — uses the browser/Edge runtime fetch.
 *
 * Usage:
 *   const data = await apiClient.post<MyResult>('/api/fal/generate-image', body);
 *   const { data, cancel } = apiClient.getCancelable<MyResult>('/api/...');
 */

export interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  /** Abort the request after this many milliseconds. Default: 60_000 */
  timeoutMs?: number;
  /** Retry idempotent requests on network errors or 5xx. Default: 0 */
  retry?: number;
  /** Delay (ms) before first retry; doubles each attempt. Default: 500 */
  retryDelayMs?: number;
  /** Parse response as this format. Default 'json'. Use 'blob' for binary. */
  parseAs?: 'json' | 'text' | 'blob' | 'response';
  /** Body — auto JSON-encoded unless already a string/FormData/Blob. */
  body?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly url: string;

  constructor(message: string, options: { status: number; body: unknown; url: string }) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.body = options.body;
    this.url = options.url;
  }
}

function isJsonBody(body: unknown): body is object {
  if (body == null) return false;
  if (typeof body === 'string') return false;
  if (body instanceof FormData) return false;
  if (body instanceof Blob) return false;
  if (body instanceof ArrayBuffer) return false;
  if (typeof (body as { arrayBuffer?: unknown }).arrayBuffer === 'function') return false;
  return typeof body === 'object';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function parseBody(res: Response, parseAs: ApiRequestOptions['parseAs']): Promise<unknown> {
  if (parseAs === 'response') return res;
  if (parseAs === 'blob') return res.blob();
  if (parseAs === 'text') return res.text();
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) return res.json();
  // Fall back to text if no JSON content-type but body exists
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function performRequest(
  method: string,
  url: string,
  options: ApiRequestOptions
): Promise<unknown> {
  const {
    timeoutMs = 60_000,
    retry = 0,
    retryDelayMs = 500,
    parseAs = 'json',
    body,
    headers: headerInit,
    signal: externalSignal,
    ...rest
  } = options;

  const maxAttempts = Math.max(1, retry + 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Request timeout')), timeoutMs);

    // Chain external abort signal into controller
    const onExternalAbort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener?.('abort', onExternalAbort);

    try {
      const headers = new Headers(headerInit);
      let preparedBody: BodyInit | null | undefined;
      if (body === undefined || body === null) {
        preparedBody = undefined;
      } else if (isJsonBody(body)) {
        if (!headers.has('content-type')) headers.set('content-type', 'application/json');
        preparedBody = JSON.stringify(body);
      } else {
        preparedBody = body as BodyInit;
      }

      const res = await fetch(url, {
        ...rest,
        method,
        headers,
        body: preparedBody,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await parseBody(res, 'json').catch(() => null);
        const message =
          (errBody && typeof errBody === 'object' && 'error' in errBody && typeof (errBody as { error: unknown }).error === 'string'
            ? (errBody as { error: string }).error
            : undefined) ||
          (errBody && typeof errBody === 'object' && 'message' in errBody && typeof (errBody as { message: unknown }).message === 'string'
            ? (errBody as { message: string }).message
            : undefined) ||
          `${method} ${url} failed with ${res.status}`;

        // 5xx is retryable; 4xx is not
        if (res.status >= 500 && attempt < maxAttempts) {
          lastError = new ApiError(message, { status: res.status, body: errBody, url });
          await sleep(retryDelayMs * 2 ** (attempt - 1));
          continue;
        }
        throw new ApiError(message, { status: res.status, body: errBody, url });
      }

      return await parseBody(res, parseAs);
    } catch (error) {
      lastError = error;
      const isAbort =
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof DOMException && error.name === 'AbortError');
      if (isAbort) throw error;
      if (error instanceof ApiError) throw error;
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener?.('abort', onExternalAbort);
    }
  }
  throw lastError ?? new Error('Request failed');
}

/** Typed wrappers. `get` retries once by default; mutations do not retry. */
export const apiClient = {
  get<T = unknown>(url: string, options: ApiRequestOptions = {}): Promise<T> {
    return performRequest('GET', url, { retry: 1, ...options }) as Promise<T>;
  },
  post<T = unknown>(url: string, body?: unknown, options: ApiRequestOptions = {}): Promise<T> {
    return performRequest('POST', url, { ...options, body }) as Promise<T>;
  },
  put<T = unknown>(url: string, body?: unknown, options: ApiRequestOptions = {}): Promise<T> {
    return performRequest('PUT', url, { ...options, body }) as Promise<T>;
  },
  patch<T = unknown>(url: string, body?: unknown, options: ApiRequestOptions = {}): Promise<T> {
    return performRequest('PATCH', url, { ...options, body }) as Promise<T>;
  },
  delete<T = unknown>(url: string, options: ApiRequestOptions = {}): Promise<T> {
    return performRequest('DELETE', url, options) as Promise<T>;
  },
  /**
   * Returns { promise, cancel } — caller can trigger cancellation without
   * managing their own AbortController.
   */
  getCancelable<T = unknown>(url: string, options: ApiRequestOptions = {}): { promise: Promise<T>; cancel: (reason?: string) => void } {
    const controller = new AbortController();
    const promise = performRequest('GET', url, { ...options, signal: controller.signal }) as Promise<T>;
    return { promise, cancel: (reason) => controller.abort(reason) };
  },
};

/** Narrow helper for error handling in call sites. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
