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
  effects: unknown[];
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

function getSceneSource(scene: Scene) {
  return (
    scene.generatedVideo?.url ||
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

  const tracks: OpenReelTrack[] = [];
  const videoTrackId = generateId('track');
  let captionsTrackId: string | null = null;

  let currentTime = 0;
  storyboard.scenes.forEach((scene, index) => {
    const mediaId = `media-${scene.id}`;
    const clipId = `clip-${scene.id}`;
    const duration = clampDuration(scene.duration, 2);

    const rawSrc = getSceneSource(scene);
    const src = rawSrc ? buildProxyUrl(rawSrc) : "";
    const isVideo = !!scene.generatedVideo?.url;
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
        duration,
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
      inPoint: 0,
      outPoint: duration,
      effects: [],
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
    });

    const subtitleText = scene.dialogue || scene.description;
    if (subtitleText) {
      const subtitleId = `subtitle-${scene.id}`;
      subtitles.push({
        id: subtitleId,
        text: subtitleText,
        startTime: currentTime,
        endTime: currentTime + duration,
        style: {
          fontFamily: 'Inter',
          fontSize: 42,
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
        text: subtitleText,
        style: {
          fontFamily: 'Inter',
          fontSize: 42,
          fontWeight: 600,
          fontStyle: 'normal',
          color: '#FFFFFF',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
          verticalAlign: 'bottom',
          lineHeight: 1.2,
          letterSpacing: 0,
        },
        transform: {
          position: { x: 0.5, y: 0.85 },
          scale: { x: 1, y: 1 },
          rotation: 0,
          anchor: { x: 0.5, y: 0.5 },
          opacity: 1,
        },
        keyframes: [],
      });
    }

    if (scene.transitionToNext && index < storyboard.scenes.length - 1) {
      const transitionType = mapTransitionType(scene.transitionToNext.type);
      if (transitionType) {
        transitions.push({
          id: `transition-${scene.id}`,
          clipAId: clipId,
          clipBId: `clip-${storyboard.scenes[index + 1].id}`,
          type: transitionType,
          duration: clampDuration(
            scene.transitionToNext.duration ?? DEFAULT_TRANSITION_DURATION,
            DEFAULT_TRANSITION_DURATION
          ),
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

  if (captionsTrackId) {
    tracks.push({
      id: captionsTrackId,
      type: 'text',
      name: 'Captions',
      clips: [],
      transitions: [],
      locked: false,
      hidden: false,
      muted: false,
      solo: false,
    });
  }

  const timeline: OpenReelTimeline = {
    tracks,
    subtitles: [],
    duration: currentTime,
    markers,
  };

  const project: OpenReelProject = {
    id: generateId('project'),
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
