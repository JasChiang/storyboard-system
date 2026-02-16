'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { X, Play, Pause, Square } from 'lucide-react';
import type { Scene } from '@/lib/types/storyboard';

interface QuickPreviewPlayerProps {
  scenes: Scene[];
  onClose: () => void;
}

export function QuickPreviewPlayer({ scenes, onClose }: QuickPreviewPlayerProps) {
  // For continuation scenes, the effective start frame is the previous scene's end frame
  const playableScenesWithUrls = scenes.map((scene, index) => {
    const prevScene = index > 0 ? scenes[index - 1] : null;
    const continuationUrl = prevScene?.transitionToNext?.useEndFrameAsNextStart
      ? prevScene.generatedEndFrame?.url
      : undefined;
    const effectiveUrl = continuationUrl || scene.generatedImage?.url;
    return { scene, effectiveUrl };
  }).filter(({ effectiveUrl }) => Boolean(effectiveUrl));

  const playableScenes = playableScenesWithUrls.map(({ scene }) => scene);
  const effectiveUrls = playableScenesWithUrls.map(({ effectiveUrl }) => effectiveUrl as string);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalScenes = playableScenes.length;
  const currentScene = playableScenes[currentIndex];

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advance = useCallback(() => {
    setCurrentIndex(prev => {
      if (prev >= totalScenes - 1) {
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [totalScenes]);

  useEffect(() => {
    if (!isPlaying || !currentScene) return;
    stopTimer();
    const durationMs = (currentScene.duration || 3) * 1000;
    timerRef.current = setTimeout(advance, durationMs);
    return stopTimer;
  }, [isPlaying, currentIndex, currentScene, advance, stopTimer]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handlePlayPause = () => {
    setIsPlaying(prev => !prev);
  };

  const handleStop = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  if (totalScenes === 0) return null;

  const progress = ((currentIndex + 1) / totalScenes) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        title="關閉 (Esc)"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Scene number */}
      <div className="absolute left-4 top-4 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
        {currentIndex + 1} / {totalScenes}
      </div>

      {/* Main image */}
      <div className="relative flex h-full max-h-[70vh] w-full max-w-4xl items-center justify-center">
        {effectiveUrls[currentIndex] && (
          <Image
            src={effectiveUrls[currentIndex]}
            alt={`Scene ${currentScene?.sceneNumber}`}
            fill
            className="object-contain"
            priority
          />
        )}
      </div>

      {/* Scene info overlay */}
      <div className="absolute bottom-24 left-0 right-0 px-8 text-center">
        <p className="text-sm font-medium text-white/90">{currentScene?.description}</p>
        {currentScene?.cameraMovement && (
          <p className="mt-1 text-xs text-white/60">{currentScene.cameraMovement}</p>
        )}
        {currentScene?.dialogue && (
          <p className="mt-1 text-sm italic text-white/75">「{currentScene.dialogue}」</p>
        )}
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-14 left-0 right-0 h-1 bg-white/20">
        <div
          className="h-full bg-white/80 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Scene dots */}
      <div className="absolute bottom-8 flex gap-1.5">
        {playableScenes.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrentIndex(i); setIsPlaying(true); }}
            className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="absolute bottom-2 flex items-center gap-3">
        <button
          onClick={handlePlayPause}
          className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          title={isPlaying ? '暫停' : '播放'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={handleStop}
          className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          title="停止"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
