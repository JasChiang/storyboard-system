import type { EditingSuggestion } from './project';
import type { Storyboard, TransitionType } from './storyboard';

export type TimelineTrackKind = 'video' | 'audio' | 'subtitle' | 'overlay';
export type TimelineClipKind = 'video' | 'image' | 'audio' | 'subtitle';
export type TimelineAudioRole = 'voiceover' | 'music' | 'sfx';

export interface TimelineClipSource {
  kind: TimelineClipKind;
  url: string;
  posterUrl?: string;
  origin?: 'scene.generatedVideo' | 'scene.generatedImage' | 'scene.generatedVoiceover' | 'storyboard.generatedMusic';
  versionSeed?: string;
}

export interface TimelineTransition {
  type: TransitionType | 'none';
  durationSec: number;
  apply: boolean;
  source?: 'scene' | 'editingSuggestion';
}

export interface TimelineClip {
  id: string;
  sceneId?: string;
  sceneNumber?: number;
  trackId: string;
  kind: TimelineClipKind;
  role?: TimelineAudioRole;
  startSec: number;
  durationSec: number;
  inPointSec?: number;
  outPointSec?: number;
  text?: string;
  source?: TimelineClipSource;
  transitionToNext?: TimelineTransition;
  metadata?: Record<string, unknown>;
}

export interface TimelineTrack {
  id: string;
  kind: TimelineTrackKind;
  name: string;
  clips: TimelineClip[];
}

export interface TimelineComposition {
  version: number;
  storyboardId: string;
  projectId: string;
  durationSec: number;
  tracks: TimelineTrack[];
  metadata?: {
    source: 'storyboard';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    fps?: number;
    editingSuggestionApplied?: boolean;
  };
}

export interface BuildTimelineCompositionOptions {
  includeSubtitles?: boolean;
  includeVoiceovers?: boolean;
  includeMusic?: boolean;
  editingSuggestion?: EditingSuggestion | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeDuration(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function normalizeTransition(raw?: string): TransitionType | 'none' {
  switch ((raw || '').toLowerCase().trim()) {
    case 'cut':
      return 'cut';
    case 'dissolve':
    case 'crossfade':
    case 'fade':
    case 'gamma_cross':
      return 'dissolve';
    case 'fade_black':
    case 'diptoblack':
    case 'dip_to_black':
      return 'fade_black';
    case 'fade_white':
    case 'diptowhite':
    case 'dip_to_white':
      return 'fade_white';
    case 'continuation':
      return 'continuation';
    case 'match_cut':
      return 'match_cut';
    case 'wipe':
    case 'wipeleft':
    case 'wiperight':
      return 'wipe';
    case 'push':
    case 'slide':
    case 'slideleft':
    case 'slideright':
      return 'push';
    case 'none':
      return 'none';
    default:
      return 'dissolve';
  }
}

export function buildTimelineComposition(
  storyboard: Storyboard,
  options: BuildTimelineCompositionOptions = {}
): TimelineComposition {
  const includeSubtitles = options.includeSubtitles !== false;
  const includeVoiceovers = options.includeVoiceovers !== false;
  const includeMusic = options.includeMusic !== false;
  const suggestionMap = new Map(
    (options.editingSuggestion?.scenes || []).map((scene) => [scene.sceneId, scene])
  );

  const videoTrack: TimelineTrack = { id: 'video-track', kind: 'video', name: 'Video Track', clips: [] };
  const subtitleTrack: TimelineTrack = { id: 'subtitle-track', kind: 'subtitle', name: 'Subtitle Track', clips: [] };
  const voiceTrack: TimelineTrack = { id: 'voice-track', kind: 'audio', name: 'Voice Over', clips: [] };
  const musicTrack: TimelineTrack = { id: 'music-track', kind: 'audio', name: 'Background Music', clips: [] };

  let currentSec = 0;
  storyboard.scenes.forEach((scene) => {
    const sceneSuggestion = suggestionMap.get(scene.id);
    const fallbackDuration = safeDuration(scene.duration, 1);
    const baseDuration = scene.generatedVideo?.url
      ? safeDuration(sceneSuggestion?.outPoint, fallbackDuration) - Math.max(0, Number(sceneSuggestion?.inPoint || 0))
      : fallbackDuration;
    const durationSec = Math.max(0.25, safeDuration(baseDuration, fallbackDuration));

    const transitionType = normalizeTransition(sceneSuggestion?.transition || scene.transitionToNext?.type);
    const transitionDurationSec = clamp(
      safeDuration(
        sceneSuggestion?.transitionDuration ?? scene.transitionToNext?.duration,
        0.5
      ),
      0.05,
      2
    );

    videoTrack.clips.push({
      id: `scene-${scene.id}`,
      sceneId: scene.id,
      sceneNumber: scene.sceneNumber,
      trackId: videoTrack.id,
      kind: scene.generatedVideo?.url ? 'video' : 'image',
      startSec: currentSec,
      durationSec,
      inPointSec: scene.generatedVideo?.url ? Math.max(0, Number(sceneSuggestion?.inPoint || 0)) : 0,
      outPointSec: scene.generatedVideo?.url
        ? Math.max(durationSec, Number(sceneSuggestion?.outPoint || durationSec))
        : durationSec,
      text: scene.dialogue || scene.description,
      source: {
        kind: scene.generatedVideo?.url ? 'video' : 'image',
        url: scene.generatedVideo?.url || scene.generatedImage?.url || scene.generatedEndFrame?.url || '',
        posterUrl: scene.generatedImage?.url,
        origin: scene.generatedVideo?.url ? 'scene.generatedVideo' : 'scene.generatedImage',
        versionSeed: [
          scene.id,
          scene.generatedVideo?.url,
          scene.generatedVideo?.timestamp,
          scene.generatedVideo?.prompt,
          scene.generatedImage?.url,
          scene.generatedImage?.timestamp,
          scene.generatedImage?.prompt,
        ].filter(Boolean).join('|') || undefined,
      },
      transitionToNext: {
        type: transitionType,
        durationSec: transitionDurationSec,
        apply: !['cut', 'continuation', 'match_cut', 'none'].includes(transitionType),
        source: sceneSuggestion?.transition ? 'editingSuggestion' : 'scene',
      },
      metadata: {
        cameraMovement: scene.cameraMovement,
        renderLane: scene.renderLane,
      },
    });

    if (includeSubtitles && (scene.generatedVoiceover?.script || scene.dialogue || scene.description)) {
      subtitleTrack.clips.push({
        id: `subtitle-${scene.id}`,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        trackId: subtitleTrack.id,
        kind: 'subtitle',
        startSec: currentSec,
        durationSec,
        text: scene.generatedVoiceover?.script || scene.dialogue || scene.description,
      });
    }

    if (includeVoiceovers && scene.generatedVoiceover?.url) {
      const voiceDurationSec = Math.min(
        durationSec,
        safeDuration(scene.generatedVoiceover.durationSeconds, durationSec)
      );
      voiceTrack.clips.push({
        id: `voice-${scene.id}`,
        sceneId: scene.id,
        sceneNumber: scene.sceneNumber,
        trackId: voiceTrack.id,
        kind: 'audio',
        role: 'voiceover',
        startSec: currentSec,
        durationSec: voiceDurationSec,
        source: {
          kind: 'audio',
          url: scene.generatedVoiceover.url,
          origin: 'scene.generatedVoiceover',
          versionSeed: [
            scene.id,
            scene.generatedVoiceover.url,
            scene.generatedVoiceover.timestamp,
            scene.generatedVoiceover.script,
            scene.generatedVoiceover.prompt,
          ].filter(Boolean).join('|') || undefined,
        },
      });
    }

    currentSec += durationSec;
  });

  if (includeMusic && storyboard.generatedMusic?.url) {
    const durationSec = Math.max(
      currentSec,
      safeDuration(storyboard.generatedMusic.durationSeconds, currentSec)
    );
    musicTrack.clips.push({
      id: 'project-music',
      trackId: musicTrack.id,
      kind: 'audio',
      role: 'music',
      startSec: 0,
      durationSec,
      source: {
        kind: 'audio',
        url: storyboard.generatedMusic.url,
        origin: 'storyboard.generatedMusic',
        versionSeed: [
          storyboard.generatedMusic.url,
          storyboard.generatedMusic.timestamp,
          storyboard.generatedMusic.prompt,
        ].filter(Boolean).join('|') || undefined,
      },
    });
  }

  return {
    version: 1,
    storyboardId: storyboard.id,
    projectId: storyboard.projectId,
    durationSec: currentSec,
    tracks: [videoTrack, subtitleTrack, voiceTrack, musicTrack].filter((track) => track.clips.length > 0),
    metadata: {
      source: 'storyboard',
      editingSuggestionApplied: Boolean(options.editingSuggestion),
    },
  };
}
