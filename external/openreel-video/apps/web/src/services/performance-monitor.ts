interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

interface WindowWithGC extends Window {
  gc?: () => void;
}

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsed: number;
  memoryLimit: number;
  memoryPercent: number;
  gpuMemoryUsed?: number;
  renderTime: number;
  drawCalls: number;
  activeClips: number;
  timestamp: number;
}

export interface PerformanceWarning {
  type: "fps" | "memory" | "render" | "general";
  severity: "low" | "medium" | "high";
  message: string;
  suggestion?: string;
  timestamp: number;
}

const FPS_SAMPLES = 60;
const MEMORY_CHECK_INTERVAL = 5000;
const FPS_LOW_THRESHOLD = 24;
const FPS_CRITICAL_THRESHOLD = 15;
const MEMORY_WARNING_THRESHOLD = 0.7;
const MEMORY_CRITICAL_THRESHOLD = 0.9;
const RENDER_TIME_WARNING = 32;
const RENDER_TIME_CRITICAL = 50;

type MetricsCallback = (metrics: PerformanceMetrics) => void;
type WarningCallback = (warning: PerformanceWarning) => void;

class PerformanceMonitor {
  private frameTimestamps: number[] = [];
  private renderTimes: number[] = [];
  private isRunning = false;
  private animationFrameId: number | null = null;
  private memoryCheckIntervalId: ReturnType<typeof setInterval> | null = null;
  private metricsListeners: Set<MetricsCallback> = new Set();
  private warningListeners: Set<WarningCallback> = new Set();
  private lastMetrics: PerformanceMetrics | null = null;
  private drawCallCount = 0;
  private activeClipCount = 0;
  private lastWarningTime: Record<string, number> = {};
  private warningCooldown = 10000;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.frameTimestamps = [];
    this.renderTimes = [];
    this.measureFrame();
    this.startMemoryMonitoring();
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.memoryCheckIntervalId !== null) {
      clearInterval(this.memoryCheckIntervalId);
      this.memoryCheckIntervalId = null;
    }
  }

  private measureFrame(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    this.frameTimestamps.push(now);

    if (this.frameTimestamps.length > FPS_SAMPLES) {
      this.frameTimestamps.shift();
    }

    if (this.frameTimestamps.length >= 2) {
      const metrics = this.calculateMetrics(now);
      this.lastMetrics = metrics;
      this.notifyMetrics(metrics);
      this.checkPerformanceWarnings(metrics);
    }

    this.animationFrameId = requestAnimationFrame(() => this.measureFrame());
  }

  private calculateMetrics(now: number): PerformanceMetrics {
    const frameCount = this.frameTimestamps.length;
    const timeSpan =
      frameCount > 1
        ? this.frameTimestamps[frameCount - 1] - this.frameTimestamps[0]
        : 0;
    const fps = frameCount > 1 ? ((frameCount - 1) / timeSpan) * 1000 : 0;
    const frameTime = frameCount > 1 ? timeSpan / (frameCount - 1) : 0;

    const avgRenderTime =
      this.renderTimes.length > 0
        ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
        : 0;

    const memory = this.getMemoryInfo();

    return {
      fps: Math.round(fps * 10) / 10,
      frameTime: Math.round(frameTime * 100) / 100,
      memoryUsed: memory.used,
      memoryLimit: memory.limit,
      memoryPercent: memory.percent,
      renderTime: Math.round(avgRenderTime * 100) / 100,
      drawCalls: this.drawCallCount,
      activeClips: this.activeClipCount,
      timestamp: now,
    };
  }

  private getMemoryInfo(): {
    used: number;
    limit: number;
    percent: number;
  } {
    const perf = performance as PerformanceWithMemory;
    if (perf.memory) {
      const used = perf.memory.usedJSHeapSize;
      const limit = perf.memory.jsHeapSizeLimit;
      return {
        used,
        limit,
        percent: limit > 0 ? used / limit : 0,
      };
    }
    return { used: 0, limit: 0, percent: 0 };
  }

  private startMemoryMonitoring(): void {
    this.memoryCheckIntervalId = setInterval(() => {
      const memory = this.getMemoryInfo();
      if (memory.percent >= MEMORY_CRITICAL_THRESHOLD) {
        this.emitWarning({
          type: "memory",
          severity: "high",
          message: `Critical memory usage: ${Math.round(memory.percent * 100)}%`,
          suggestion:
            "Consider closing unused media, reducing preview quality, or splitting your project.",
        });
      } else if (memory.percent >= MEMORY_WARNING_THRESHOLD) {
        this.emitWarning({
          type: "memory",
          severity: "medium",
          message: `High memory usage: ${Math.round(memory.percent * 100)}%`,
          suggestion: "Close unused browser tabs or reduce media library size.",
        });
      }
    }, MEMORY_CHECK_INTERVAL);
  }

  private checkPerformanceWarnings(metrics: PerformanceMetrics): void {
    if (metrics.fps < FPS_CRITICAL_THRESHOLD && metrics.fps > 0) {
      this.emitWarning({
        type: "fps",
        severity: "high",
        message: `Very low frame rate: ${metrics.fps} fps`,
        suggestion:
          "Reduce preview resolution, disable effects, or use proxy media.",
      });
    } else if (metrics.fps < FPS_LOW_THRESHOLD && metrics.fps > 0) {
      this.emitWarning({
        type: "fps",
        severity: "medium",
        message: `Low frame rate: ${metrics.fps} fps`,
        suggestion: "Consider reducing preview quality for smoother playback.",
      });
    }

    if (metrics.renderTime > RENDER_TIME_CRITICAL) {
      this.emitWarning({
        type: "render",
        severity: "high",
        message: `Slow render time: ${metrics.renderTime}ms`,
        suggestion: "Disable complex effects or reduce clip count in view.",
      });
    } else if (metrics.renderTime > RENDER_TIME_WARNING) {
      this.emitWarning({
        type: "render",
        severity: "medium",
        message: `High render time: ${metrics.renderTime}ms`,
        suggestion:
          "Consider simplifying effects or reducing preview resolution.",
      });
    }
  }

  private emitWarning(warning: Omit<PerformanceWarning, "timestamp">): void {
    const key = `${warning.type}-${warning.severity}`;
    const now = Date.now();

    if (
      this.lastWarningTime[key] &&
      now - this.lastWarningTime[key] < this.warningCooldown
    ) {
      return;
    }

    this.lastWarningTime[key] = now;
    const fullWarning: PerformanceWarning = { ...warning, timestamp: now };
    this.warningListeners.forEach((cb) => cb(fullWarning));
  }

  recordRenderTime(time: number): void {
    this.renderTimes.push(time);
    if (this.renderTimes.length > FPS_SAMPLES) {
      this.renderTimes.shift();
    }
  }

  recordDrawCalls(count: number): void {
    this.drawCallCount = count;
  }

  recordActiveClips(count: number): void {
    this.activeClipCount = count;
  }

  getLastMetrics(): PerformanceMetrics | null {
    return this.lastMetrics;
  }

  getAverageFPS(): number {
    return this.lastMetrics?.fps ?? 0;
  }

  onMetrics(callback: MetricsCallback): () => void {
    this.metricsListeners.add(callback);
    return () => this.metricsListeners.delete(callback);
  }

  onWarning(callback: WarningCallback): () => void {
    this.warningListeners.add(callback);
    return () => this.warningListeners.delete(callback);
  }

  private notifyMetrics(metrics: PerformanceMetrics): void {
    this.metricsListeners.forEach((cb) => cb(metrics));
  }

  forceGC(): void {
    const win = window as WindowWithGC;
    if (win.gc) {
      win.gc();
    }
  }

  getPerformanceScore(): number {
    if (!this.lastMetrics) return 100;

    let score = 100;

    if (this.lastMetrics.fps < FPS_LOW_THRESHOLD) {
      score -= 30;
    } else if (this.lastMetrics.fps < 30) {
      score -= 15;
    }

    if (this.lastMetrics.memoryPercent > MEMORY_CRITICAL_THRESHOLD) {
      score -= 30;
    } else if (this.lastMetrics.memoryPercent > MEMORY_WARNING_THRESHOLD) {
      score -= 15;
    }

    if (this.lastMetrics.renderTime > RENDER_TIME_CRITICAL) {
      score -= 20;
    } else if (this.lastMetrics.renderTime > RENDER_TIME_WARNING) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];

    if (!this.lastMetrics) return suggestions;

    if (this.lastMetrics.fps < FPS_LOW_THRESHOLD) {
      suggestions.push("Lower preview resolution to 720p or 480p");
      suggestions.push("Disable real-time effects preview");
      suggestions.push("Use proxy media for large files");
    }

    if (this.lastMetrics.memoryPercent > MEMORY_WARNING_THRESHOLD) {
      suggestions.push("Clear unused media from library");
      suggestions.push("Close other browser tabs");
      suggestions.push("Split large projects into smaller sequences");
    }

    if (this.lastMetrics.renderTime > RENDER_TIME_WARNING) {
      suggestions.push("Reduce number of simultaneous effects");
      suggestions.push("Use simpler transitions");
      suggestions.push("Lower color grading complexity");
    }

    if (this.lastMetrics.activeClips > 10) {
      suggestions.push("Pre-render complex sections as nested sequences");
      suggestions.push("Reduce overlapping clips on multiple tracks");
    }

    return suggestions;
  }
}

export const performanceMonitor = new PerformanceMonitor();

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
