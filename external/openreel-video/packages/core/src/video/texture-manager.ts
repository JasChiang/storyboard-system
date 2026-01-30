import {
  TextureCache,
  calculateTextureSize,
  type CachedTexture,
} from "./texture-cache";

export interface TextureManagerConfig {
  device: GPUDevice;
  maxCacheSize?: number;
  cleanupDelayMs?: number;
  onTextureCreated?: (clipId: string, frameTime: number, size: number) => void;
  onTextureReleased?: (clipId: string, frameTime: number) => void;
}

interface PendingCleanup {
  clipId: string;
  timeoutId: ReturnType<typeof setTimeout>;
  scheduledAt: number;
}

const DEFAULT_CLEANUP_DELAY_MS = 5000;

export class TextureManager {
  private device: GPUDevice;
  private cache: TextureCache;
  private cleanupDelayMs: number;
  private pendingCleanups: Map<string, PendingCleanup> = new Map();
  private onTextureCreated?: (
    clipId: string,
    frameTime: number,
    size: number,
  ) => void;
  private onTextureReleased?: (clipId: string, frameTime: number) => void;

  constructor(config: TextureManagerConfig) {
    this.device = config.device;
    this.cleanupDelayMs = config.cleanupDelayMs ?? DEFAULT_CLEANUP_DELAY_MS;
    this.onTextureCreated = config.onTextureCreated;
    this.onTextureReleased = config.onTextureReleased;

    this.cache = new TextureCache({
      maxSize: config.maxCacheSize,
      onEvict: (entry: CachedTexture) => {
        if (this.onTextureReleased) {
          this.onTextureReleased(entry.clipId, entry.frameTime);
        }
      },
    });
  }

  createTextureFromImage(
    image: ImageBitmap,
    clipId: string,
    frameTime: number,
  ): GPUTexture {
    const cached = this.cache.get(clipId, frameTime);
    if (cached) {
      // Cancel any pending cleanup for this clip
      this.cancelPendingCleanup(clipId);
      return cached;
    }
    const texture = this.device.createTexture({
      size: { width: image.width, height: image.height },
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
      label: `texture-${clipId}-${frameTime}`,
    });

    // Use copyExternalImageToTexture for zero-copy transfer
    this.device.queue.copyExternalImageToTexture(
      { source: image },
      { texture },
      { width: image.width, height: image.height },
    );
    const size = calculateTextureSize(image.width, image.height, "rgba8unorm");
    this.cache.set(clipId, frameTime, texture, size);

    // Cancel any pending cleanup for this clip
    this.cancelPendingCleanup(clipId);

    // Notify callback
    if (this.onTextureCreated) {
      this.onTextureCreated(clipId, frameTime, size);
    }

    return texture;
  }

  getTexture(clipId: string, frameTime: number): GPUTexture | null {
    const texture = this.cache.get(clipId, frameTime);
    if (texture) {
      // Cancel any pending cleanup for this clip
      this.cancelPendingCleanup(clipId);
    }
    return texture;
  }

  hasTexture(clipId: string, frameTime: number): boolean {
    return this.cache.has(clipId, frameTime);
  }

  scheduleCleanup(clipId: string): void {
    // Cancel any existing pending cleanup
    this.cancelPendingCleanup(clipId);

    // Schedule new cleanup
    const timeoutId = setTimeout(() => {
      this.executeCleanup(clipId);
    }, this.cleanupDelayMs);

    this.pendingCleanups.set(clipId, {
      clipId,
      timeoutId,
      scheduledAt: Date.now(),
    });
  }

  cancelPendingCleanup(clipId: string): void {
    const pending = this.pendingCleanups.get(clipId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pendingCleanups.delete(clipId);
    }
  }

  private executeCleanup(clipId: string): void {
    this.pendingCleanups.delete(clipId);
    this.cache.evict(clipId);
  }

  releaseClip(clipId: string): void {
    this.cancelPendingCleanup(clipId);
    this.cache.evict(clipId);
  }

  releaseTexture(_clipId: string, _frameTime: number): void {
    // so we just let LRU handle it
  }

  getMemoryUsage(): number {
    return this.cache.getMemoryUsage();
  }

  getCachedCount(): number {
    return this.cache.getCount();
  }

  getPendingCleanupCount(): number {
    return this.pendingCleanups.size;
  }

  hasPendingCleanup(clipId: string): boolean {
    return this.pendingCleanups.has(clipId);
  }

  getCleanupDelayMs(): number {
    return this.cleanupDelayMs;
  }

  clear(): void {
    // Cancel all pending cleanups
    for (const pending of this.pendingCleanups.values()) {
      clearTimeout(pending.timeoutId);
    }
    this.pendingCleanups.clear();
    this.cache.clear();
  }

  destroy(): void {
    this.clear();
  }

  getCache(): TextureCache {
    return this.cache;
  }
}
