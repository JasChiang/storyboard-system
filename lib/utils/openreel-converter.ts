import type { Storyboard, Scene, TransitionType } from '@/lib/types/storyboard';
import type { EditingSuggestion } from '@/lib/types/project';

const SCHEMA_VERSION = '1.0.0';

interface OpenReelProjectSettings {
  width: number;
  height: number;
  frameRate: number;
  sampleRate: number;
  channels: number;
}

interface OpenReelMediaMetadata {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  codec: string;
  sampleRate: number;
  channels: number;
  fileSize: number;
}

interface OpenReelMediaItem {
  id: string;
  name: string;
  type: 'video' | 'image' | 'audio';
  fileHandle: null;
  blob: null;
  metadata: OpenReelMediaMetadata;
  thumbnailUrl: string | null;
  waveformData: null;
  isPlaceholder?: boolean;
  originalUrl?: string;
}

interface OpenReelClip {
  id: string;
  mediaId: string;
  trackId: string;
  startTime: number;
  duration: number;
  inPoint: number;
  outPoint: number;
  effects: OpenReelEffect[];
  audioEffects: unknown[];
  transform: {
    position: { x: number; y: number };
    scale: { x: number; y: number };
    rotation: number;
    anchor: { x: number; y: number };
    opacity: number;
    fitMode: 'cover' | 'contain' | 'stretch' | 'none';
  };
  volume: number;
  keyframes: unknown[];
  speed?: number;
}

interface OpenReelEffect {
  id: string;
  type: string;
  params: Record<string, unknown>;
  enabled: boolean;
}

interface OpenReelTransition {
  id: string;
  clipAId: string;
  clipBId: string;
  type: OpenReelTransitionType;
  duration: number;
  params: Record<string, unknown>;
}

interface OpenReelTrack {
  id: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'graphics';
  name: string;
  clips: OpenReelClip[];
  transitions: OpenReelTransition[];
  locked: boolean;
  hidden: boolean;
  muted: boolean;
  solo: boolean;
}

interface OpenReelMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

interface OpenReelSubtitle {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  style?: {
    fontFamily: string;
    fontSize: number;
    color: string;
    backgroundColor: string;
    strokeColor?: string;
    strokeWidth?: number;
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    position: 'top' | 'center' | 'bottom';
  };
}

interface OpenReelTextClip {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  text: string;
  style: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number | 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    color: string;
    backgroundColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    shadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    textAlign: 'left' | 'center' | 'right' | 'justify';
    verticalAlign: 'top' | 'middle' | 'bottom';
    lineHeight: number;
    letterSpacing: number;
  };
  transform: {
    position: { x: number; y: number };
    scale: { x: number; y: number };
    rotation: number;
    anchor: { x: number; y: number };
    opacity: number;
  };
  keyframes: unknown[];
}

interface OpenReelTimeline {
  tracks: OpenReelTrack[];
  subtitles: OpenReelSubtitle[];
  duration: number;
  markers: OpenReelMarker[];
}

interface OpenReelProject {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  settings: OpenReelProjectSettings;
  mediaLibrary: { items: OpenReelMediaItem[] };
  timeline: OpenReelTimeline;
  textClips?: OpenReelTextClip[];
}

interface OpenReelProjectFile {
  version: string;
  project: OpenReelProject;
}

type OpenReelTransitionType =
  | 'crossfade'
  | 'dipToBlack'
  | 'dipToWhite'
  | 'wipe'
  | 'slide'
  | 'zoom'
  | 'push';

const DEFAULT_SETTINGS: OpenReelProjectSettings = {
  width: 1920,
  height: 1080,
  frameRate: 30,
  sampleRate: 48000,
  channels: 2,
};

const DEFAULT_TRANSITION_DURATION = 0.5;
const DEFAULT_APP_ORIGIN = "http://localhost:3000";
const DEFAULT_CAPTION_BG_COLOR = "transparent";
const DEFAULT_CAPTION_STROKE_COLOR = "#000000";
const DEFAULT_CAPTION_STROKE_WIDTH = 2;
const DEFAULT_CAPTION_SHADOW_COLOR = "rgba(0, 0, 0, 0.55)";
const DEFAULT_CAPTION_SHADOW_BLUR = 6;
const DEFAULT_CAPTION_SHADOW_OFFSET_X = 0;
const DEFAULT_CAPTION_SHADOW_OFFSET_Y = 2;

function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function clampDuration(value: number, fallback = 0.5) {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function clampRange(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * 根據 canvas 寬度和字體大小自動斷行。
 * CJK 字元每個約佔 fontSize px，Latin 字元約佔 fontSize * 0.6 px。
 */
function wrapText(text: string, canvasWidth: number, fontSize: number): string {
  const maxLineWidth = canvasWidth * 0.85;
  const isCJK = (ch: string) => /[\u3000-\u9fff\uf900-\ufaff\uff01-\uff60]/.test(ch);
  const charWidth = (ch: string) => isCJK(ch) ? fontSize : fontSize * 0.6;

  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    let lineWidth = 0;
    for (const ch of paragraph) {
      const w = charWidth(ch);
      if (lineWidth + w > maxLineWidth && line.length > 0) {
        lines.push(line);
        line = ch;
        lineWidth = w;
      } else {
        line += ch;
        lineWidth += w;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function mapTransitionType(type?: TransitionType): OpenReelTransitionType | null {
  if (!type) return null;
  switch (type) {
    case 'dissolve':
      return 'crossfade';
    case 'fade_black':
      return 'dipToBlack';
    case 'fade_white':
      return 'dipToWhite';
    case 'wipe':
      return 'wipe';
    case 'push':
      return 'push';
    case 'cut':
    case 'continuation':
    case 'match_cut':
    default:
      return null;
  }
}

function mapSuggestedTransitionType(raw?: string): OpenReelTransitionType | '__none__' | null {
  if (!raw) return null;
  const value = raw.toLowerCase().trim();

  if (['crossfade', 'dissolve', 'fade', 'gamma_cross'].includes(value)) return 'crossfade';
  if (['diptoblack', 'dip_to_black', 'fade_black'].includes(value)) return 'dipToBlack';
  if (['diptowhite', 'dip_to_white', 'fade_white'].includes(value)) return 'dipToWhite';
  if (['wipe', 'wipeleft', 'wiperight', 'wipeup', 'wipedown'].includes(value)) return 'wipe';
  if (['slide', 'slideleft', 'slideright', 'slideup', 'slidedown'].includes(value)) return 'slide';
  if (['push'].includes(value)) return 'push';
  if (['zoom'].includes(value)) return 'zoom';
  if (['cut', 'continuation', 'match_cut', 'none'].includes(value)) return '__none__';

  return null;
}

function buildOpenReelEffects(effectNames: string[]): OpenReelEffect[] {
  const effects: OpenReelEffect[] = [];
  const names = effectNames.map(name => name.toLowerCase());

  const add = (type: string, params: Record<string, unknown>) => {
    effects.push({
      id: generateId(`effect-${type}`),
      type,
      params,
      enabled: true,
    });
  };

  for (const name of names) {
    if (name.includes('brightness') || name.includes('exposure')) {
      add('brightness', { value: 0.1 });
      continue;
    }
    if (name.includes('contrast')) {
      add('contrast', { value: 1.08 });
      continue;
    }
    if (name.includes('saturation') || name.includes('color')) {
      add('saturation', { value: 1.08 });
      continue;
    }
    if (name.includes('blur')) {
      add('blur', { radius: 2, type: 'gaussian' });
      continue;
    }
    if (name.includes('vignette') || name.includes('glow')) {
      add('vignette', { amount: 0.22, midpoint: 0.5, feather: 0.35 });
      continue;
    }
    if (name.includes('grain')) {
      add('grain', { amount: 0.08, size: 1 });
    }
  }

  return effects;
}

function getSceneSource(scene: Scene, continuationStartUrl?: string) {
  return (
    scene.generatedVideo?.url ||
    continuationStartUrl ||
    scene.generatedImage?.url ||
    scene.generatedEndFrame?.url ||
    scene.referenceImage ||
    ''
  );
}

function getAppOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_ORIGIN || DEFAULT_APP_ORIGIN;
}

function buildProxyUrl(source: string) {
  const origin = getAppOrigin();
  return `${origin}/api/openreel/asset?url=${encodeURIComponent(source)}`;
}

export function convertToOpenReelProjectFile(
  storyboard: Storyboard,
  projectName: string,
  options?: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    fps?: number;
    editingSuggestion?: EditingSuggestion | null;
    sourceProjectId?: string;
  }
): OpenReelProjectFile {
  const now = Date.now();
  const aspectRatio = options?.aspectRatio ?? '16:9';
  const fps = options?.fps ?? DEFAULT_SETTINGS.frameRate;

  const dimensionMap: Record<typeof aspectRatio, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
  };

  const { width, height } = dimensionMap[aspectRatio];
  const settings: OpenReelProjectSettings = {
    ...DEFAULT_SETTINGS,
    width,
    height,
    frameRate: fps,
  };

  const mediaItems: OpenReelMediaItem[] = [];
  const clips: OpenReelClip[] = [];
  const transitions: OpenReelTransition[] = [];
  const subtitles: OpenReelSubtitle[] = [];
  const textClips: OpenReelTextClip[] = [];
  const markers: OpenReelMarker[] = [];
  const sceneSuggestionMap = new Map(
    (options?.editingSuggestion?.scenes || []).map(scene => [scene.sceneId, scene])
  );

  const tracks: OpenReelTrack[] = [];
  const videoTrackId = generateId('track');
  let captionsTrackId: string | null = null;

  let currentTime = 0;
  storyboard.scenes.forEach((scene, index) => {
    const mediaId = `media-${scene.id}`;
    const clipId = `clip-${scene.id}`;
    const previousScene = index > 0 ? storyboard.scenes[index - 1] : null;
    const continuationStartUrl = previousScene?.transitionToNext?.useEndFrameAsNextStart
      ? previousScene.generatedEndFrame?.url
      : undefined;
    const sceneSuggestion = sceneSuggestionMap.get(scene.id);
    const sceneBaseDuration = clampDuration(scene.duration, 2);
    const isVideo = !!scene.generatedVideo?.url;
    const knownVideoDuration = Number(scene.generatedVideo?.durationSeconds);
    const hasKnownVideoDuration = isVideo && Number.isFinite(knownVideoDuration) && knownVideoDuration > 0;
    const mediaDuration = isVideo
      ? (hasKnownVideoDuration ? knownVideoDuration : sceneBaseDuration)
      : sceneBaseDuration;
    const rawInPoint = Number(sceneSuggestion?.inPoint);
    const rawOutPoint = Number(sceneSuggestion?.outPoint);
    // Guardrail: 只有在「已知素材實際長度」時才套用 AI in/out，避免超長 in/out 導致黑畫面。
    // 對舊資料（無 durationSeconds）採安全全段策略。
    const isValidInOut =
      isVideo &&
      hasKnownVideoDuration &&
      Number.isFinite(rawInPoint) &&
      Number.isFinite(rawOutPoint) &&
      rawInPoint >= 0 &&
      rawOutPoint > rawInPoint &&
      rawOutPoint <= mediaDuration;
    const inPoint = isValidInOut ? clampRange(rawInPoint, 0, Math.max(0, mediaDuration - 0.1), 0) : 0;
    const defaultOutPoint = clampRange(sceneBaseDuration, 0.1, mediaDuration, mediaDuration);
    const outPoint = isValidInOut
      ? clampRange(rawOutPoint, inPoint + 0.1, mediaDuration, defaultOutPoint)
      : defaultOutPoint;
    const duration = clampDuration(outPoint - inPoint, defaultOutPoint);
    const speed = clampRange(Number(sceneSuggestion?.speedFactor), 0.25, 3, 1);
    const effects = buildOpenReelEffects(sceneSuggestion?.effects || []);

    const rawSrc = getSceneSource(scene, continuationStartUrl);
    const src = rawSrc ? buildProxyUrl(rawSrc) : "";
    const type = isVideo ? 'video' : 'image';

    const rawThumbnail = scene.generatedImage?.url ?? (!isVideo ? rawSrc || null : null);
    const thumbnailUrl = rawThumbnail ? buildProxyUrl(rawThumbnail) : null;

    mediaItems.push({
      id: mediaId,
      name: `Scene ${scene.sceneNumber}`,
      type,
      fileHandle: null,
      blob: null,
      metadata: {
        duration: mediaDuration,
        width,
        height,
        frameRate: fps,
        codec: '',
        sampleRate: DEFAULT_SETTINGS.sampleRate,
        channels: DEFAULT_SETTINGS.channels,
        fileSize: 0,
      },
      thumbnailUrl,
      waveformData: null,
      isPlaceholder: !src,
      originalUrl: src || undefined,
    });

    clips.push({
      id: clipId,
      mediaId,
      trackId: videoTrackId,
      startTime: currentTime,
      duration,
      inPoint,
      outPoint,
      effects,
      audioEffects: [],
      transform: {
        position: { x: 0.5, y: 0.5 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
        opacity: 1,
        fitMode: 'cover',
      },
      volume: 1,
      keyframes: [],
      speed: speed !== 1 ? speed : undefined,
    });

    const subtitleText = scene.dialogue || scene.description;
    if (subtitleText) {
      const SUBTITLE_FONT_SIZE = 60;
      const wrappedText = wrapText(subtitleText, width, SUBTITLE_FONT_SIZE);
      const subtitleId = `subtitle-${scene.id}`;
      subtitles.push({
        id: subtitleId,
        text: wrappedText,
        startTime: currentTime,
        endTime: currentTime + duration,
        style: {
          fontFamily: 'Inter',
          fontSize: SUBTITLE_FONT_SIZE,
          color: '#FFFFFF',
          backgroundColor: DEFAULT_CAPTION_BG_COLOR,
          strokeColor: DEFAULT_CAPTION_STROKE_COLOR,
          strokeWidth: DEFAULT_CAPTION_STROKE_WIDTH,
          shadowColor: DEFAULT_CAPTION_SHADOW_COLOR,
          shadowBlur: DEFAULT_CAPTION_SHADOW_BLUR,
          shadowOffsetX: DEFAULT_CAPTION_SHADOW_OFFSET_X,
          shadowOffsetY: DEFAULT_CAPTION_SHADOW_OFFSET_Y,
          position: 'bottom',
        },
      });

      if (!captionsTrackId) {
        captionsTrackId = generateId('track');
      }

      textClips.push({
        id: `text-${scene.id}`,
        trackId: captionsTrackId,
        startTime: currentTime,
        duration,
        text: wrappedText,
        style: {
          fontFamily: 'Inter',
          fontSize: SUBTITLE_FONT_SIZE,
          fontWeight: 600,
          fontStyle: 'normal',
          color: '#FFFFFF',
          backgroundColor: DEFAULT_CAPTION_BG_COLOR,
          strokeColor: DEFAULT_CAPTION_STROKE_COLOR,
          strokeWidth: DEFAULT_CAPTION_STROKE_WIDTH,
          shadowColor: DEFAULT_CAPTION_SHADOW_COLOR,
          shadowBlur: DEFAULT_CAPTION_SHADOW_BLUR,
          shadowOffsetX: DEFAULT_CAPTION_SHADOW_OFFSET_X,
          shadowOffsetY: DEFAULT_CAPTION_SHADOW_OFFSET_Y,
          textAlign: 'center',
          verticalAlign: 'bottom',
          lineHeight: 1.2,
          letterSpacing: 0,
        },
        transform: {
          position: { x: 0.5, y: 0.94 },
          scale: { x: 1, y: 1 },
          rotation: 0,
          anchor: { x: 0.5, y: 0.5 },
          opacity: 1,
        },
        keyframes: [],
      });
    }

    if (index < storyboard.scenes.length - 1) {
      const suggestedTransitionType = mapSuggestedTransitionType(sceneSuggestion?.transition);
      const fallbackTransitionType = mapTransitionType(scene.transitionToNext?.type);
      const transitionType = suggestedTransitionType === '__none__'
        ? null
        : (suggestedTransitionType ?? fallbackTransitionType);
      if (transitionType) {
        const suggestedTransitionDuration = Number(sceneSuggestion?.transitionDuration);
        const globalTransitionDuration = Number(options?.editingSuggestion?.transitionDuration);
        const sceneTransitionDuration = Number(scene.transitionToNext?.duration);
        const transitionDuration = Number.isFinite(suggestedTransitionDuration)
          ? suggestedTransitionDuration
          : Number.isFinite(sceneTransitionDuration)
            ? sceneTransitionDuration
            : Number.isFinite(globalTransitionDuration)
              ? globalTransitionDuration
              : DEFAULT_TRANSITION_DURATION;
        transitions.push({
          id: `transition-${scene.id}`,
          clipAId: clipId,
          clipBId: `clip-${storyboard.scenes[index + 1].id}`,
          type: transitionType,
          duration: clampDuration(transitionDuration, DEFAULT_TRANSITION_DURATION),
          params: {},
        });
      }
    }

    currentTime += duration;
  });

  if (options?.editingSuggestion?.timeline) {
    options.editingSuggestion.timeline.forEach((marker, index) => {
      markers.push({
        id: `marker-${index + 1}`,
        time: marker.time,
        label: marker.description,
        color: marker.type === 'transition' ? '#F59E0B' : '#38BDF8',
      });
    });
  }

  // Keep caption track as overlay layer above video.
  // OpenReel uses track ordering for layer stack in timeline/editor UX.
  if (captionsTrackId) {
    tracks.push({
      id: captionsTrackId,
      type: 'text',
      name: 'Captions Overlay',
      clips: [],
      transitions: [],
      locked: false,
      hidden: false,
      muted: false,
      solo: false,
    });
  }

  tracks.push({
    id: videoTrackId,
    type: 'video',
    name: 'Video Track',
    clips,
    transitions,
    locked: false,
    hidden: false,
    muted: false,
    solo: false,
  });

  const timeline: OpenReelTimeline = {
    tracks,
    subtitles: [],
    duration: currentTime,
    markers,
  };

  const stableProjectId = options?.sourceProjectId?.trim()
    ? `project-${options.sourceProjectId.trim()}`
    : generateId('project');

  const project: OpenReelProject = {
    id: stableProjectId,
    name: projectName,
    createdAt: now,
    modifiedAt: now,
    settings,
    mediaLibrary: { items: mediaItems },
    timeline,
    textClips: textClips.length > 0 ? textClips : undefined,
  };

  return {
    version: SCHEMA_VERSION,
    project,
  };
}

export function serializeOpenReelProjectFile(projectFile: OpenReelProjectFile) {
  return JSON.stringify(projectFile);
}
