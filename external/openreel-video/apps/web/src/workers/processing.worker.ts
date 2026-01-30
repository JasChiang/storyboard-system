/**
 * Processing Web Worker
 * Handles heavy media processing tasks off the main thread
 */

export interface WorkerMessage {
  type: string;
  payload: unknown;
}

export interface WorkerResponse {
  type: string;
  payload: unknown;
  error?: string;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type } = event.data;

  try {
    switch (type) {
      case "ping":
        self.postMessage({ type: "pong", payload: { timestamp: Date.now() } });
        break;
      default:
        self.postMessage({
          type: "error",
          payload: null,
          error: `Unknown message type: ${type}`,
        });
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: null,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export {};
