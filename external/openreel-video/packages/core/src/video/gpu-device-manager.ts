export interface GPUDeviceOptions {
  powerPreference?: "low-power" | "high-performance";
  requiredFeatures?: GPUFeatureName[];
  requiredLimits?: Record<string, number>;
  maxTextureDimension?: number;
  onDeviceLost?: (reason: string, message: string) => void;
  onDeviceRecovered?: () => void;
  maxRecreationAttempts?: number;
  recreationDelayMs?: number;
}

export type DeviceState =
  | "uninitialized"
  | "initializing"
  | "ready"
  | "lost"
  | "recovering"
  | "failed";

export interface ShaderCompilationResult {
  success: boolean;
  module: GPUShaderModule | null;
  errors: string[];
  warnings: string[];
}

export class GPUDeviceManager {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private options: Required<GPUDeviceOptions>;
  private state: DeviceState = "uninitialized";
  private _recreationAttempts = 0;
  private deviceLostCallbacks: Array<
    (reason: string, message: string) => void
  > = [];
  private deviceRecoveredCallbacks: Array<() => void> = [];

  constructor(options: GPUDeviceOptions = {}) {
    this.options = {
      powerPreference: options.powerPreference ?? "high-performance",
      requiredFeatures: options.requiredFeatures ?? [],
      requiredLimits: options.requiredLimits ?? {},
      maxTextureDimension: options.maxTextureDimension ?? 4096,
      onDeviceLost: options.onDeviceLost ?? (() => {}),
      onDeviceRecovered: options.onDeviceRecovered ?? (() => {}),
      maxRecreationAttempts: options.maxRecreationAttempts ?? 3,
      recreationDelayMs: options.recreationDelayMs ?? 1000,
    };
  }

  static isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "gpu" in navigator &&
      navigator.gpu !== undefined
    );
  }

  async initialize(): Promise<boolean> {
    if (this.state === "ready") {
      return true;
    }

    if (!GPUDeviceManager.isSupported()) {
      console.warn("[GPUDeviceManager] WebGPU not supported");
      this.state = "failed";
      return false;
    }

    this.state = "initializing";

    try {
      // Request adapter with specified power preference
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: this.options.powerPreference,
      });

      if (!this.adapter) {
        console.warn("[GPUDeviceManager] No GPU adapter available");
        this.state = "failed";
        return false;
      }
      const requiredLimits: Record<string, number> = {
        maxTextureDimension2D: this.options.maxTextureDimension,
        maxBindGroups: 4,
        maxSampledTexturesPerShaderStage: 16,
        ...this.options.requiredLimits,
      };

      // Request device with required features and limits
      this.device = await this.adapter.requestDevice({
        requiredFeatures: this.options.requiredFeatures,
        requiredLimits,
      });
      this.setupDeviceLossHandling();

      this.state = "ready";
      this._recreationAttempts = 0;

      return true;
    } catch (error) {
      console.error("[GPUDeviceManager] Initialization failed:", error);
      this.state = "failed";
      return false;
    }
  }

  private setupDeviceLossHandling(): void {
    if (!this.device) return;

    this.device.lost.then((info: GPUDeviceLostInfo) => {
      console.warn(
        `[GPUDeviceManager] Device lost: ${info.reason}`,
        info.message,
      );
      this.state = "lost";

      this.options.onDeviceLost(info.reason, info.message);
      for (const callback of this.deviceLostCallbacks) {
        callback(info.reason, info.message);
      }

      this.attemptRecovery().catch((error) => {
        console.error("[GPUDeviceManager] Recovery failed:", error);
        this.state = "failed";
      });
    });
  }

  private async attemptRecovery(): Promise<void> {
    if (this.state === "recovering") {
      return;
    }

    this.state = "recovering";

    for (
      let attempt = 1;
      attempt <= this.options.maxRecreationAttempts;
      attempt++
    ) {
      this._recreationAttempts = attempt;

      // Wait before attempting
      await new Promise((resolve) =>
        setTimeout(resolve, this.options.recreationDelayMs),
      );

      // Clean up old resources
      this.cleanup();
      const success = await this.initialize();
      if (success) {
        this.options.onDeviceRecovered();
        for (const callback of this.deviceRecoveredCallbacks) {
          callback();
        }
        return;
      }
    }

    console.error(
      `[GPUDeviceManager] Failed to recover device after ${this.options.maxRecreationAttempts} attempts`,
    );
    this.state = "failed";
  }

  async compileShader(
    code: string,
    label?: string,
  ): Promise<ShaderCompilationResult> {
    if (!this.device || this.state !== "ready") {
      return {
        success: false,
        module: null,
        errors: ["Device not ready"],
        warnings: [],
      };
    }

    try {
      const module = this.device.createShaderModule({
        code,
        label,
      });
      // We return the module and let pipeline creation handle validation

      return {
        success: true,
        module,
        errors: [],
        warnings: [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[GPUDeviceManager] Shader compilation failed: ${errorMessage}`,
      );

      return {
        success: false,
        module: null,
        errors: [errorMessage],
        warnings: [],
      };
    }
  }

  createTexture(
    descriptor: GPUTextureDescriptor,
    onMemoryExhausted?: () => void,
  ): GPUTexture | null {
    if (!this.device || this.state !== "ready") {
      return null;
    }

    try {
      return this.device.createTexture(descriptor);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("out of memory") ||
        errorMessage.includes("allocation failed") ||
        errorMessage.includes("memory")
      ) {
        console.warn(
          "[GPUDeviceManager] GPU memory exhausted, triggering cleanup",
        );

        // Notify caller to release unused textures
        if (onMemoryExhausted) {
          onMemoryExhausted();
        }

        // Retry texture creation after cleanup
        try {
          return this.device.createTexture(descriptor);
        } catch (retryError) {
          console.error(
            "[GPUDeviceManager] Texture creation failed after cleanup:",
            retryError,
          );
          return null;
        }
      }

      console.error("[GPUDeviceManager] Texture creation failed:", error);
      return null;
    }
  }

  onDeviceLost(callback: (reason: string, message: string) => void): void {
    this.deviceLostCallbacks.push(callback);
  }

  onDeviceRecovered(callback: () => void): void {
    this.deviceRecoveredCallbacks.push(callback);
  }

  getState(): DeviceState {
    return this.state;
  }

  getDevice(): GPUDevice | null {
    return this.device;
  }

  getAdapter(): GPUAdapter | null {
    return this.adapter;
  }

  isReady(): boolean {
    return this.state === "ready" && this.device !== null;
  }

  getRecreationAttempts(): number {
    return this._recreationAttempts;
  }

  cleanup(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.adapter = null;
  }

  destroy(): void {
    this.cleanup();
    this.deviceLostCallbacks = [];
    this.deviceRecoveredCallbacks = [];
    this.state = "uninitialized";
  }
}

export async function createGPUDeviceManager(
  options?: GPUDeviceOptions,
): Promise<GPUDeviceManager | null> {
  const manager = new GPUDeviceManager(options);
  const success = await manager.initialize();

  if (!success) {
    manager.destroy();
    return null;
  }

  return manager;
}
