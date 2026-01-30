'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Film, Maximize2 } from 'lucide-react';
import { Player } from '@remotion/player';
import { Button } from '@/components/ui/button';
import type { Storyboard } from '@/lib/types/storyboard';
import type { EditingSuggestion } from '@/lib/types/project';
import { Composition } from '@/lib/remotion/Composition';
import { convertToRemotionProps } from '@/lib/utils/remotion-converter';
import { RemotionTimeline } from '@/components/export/RemotionTimeline';

interface RemotionEditorProps {
  projectId: string;
  projectName: string;
  storyboard: Storyboard;
  aiSuggestion?: EditingSuggestion;
}

export function RemotionEditor({
  projectId,
  projectName,
  storyboard,
}: RemotionEditorProps) {
  const [editableScenes, setEditableScenes] = useState(storyboard.scenes);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderMessage, setRenderMessage] = useState<string | null>(null);

  useEffect(() => {
    setEditableScenes(storyboard.scenes);
  }, [storyboard.scenes]);

  const remotionProps = useMemo(() => {
    return convertToRemotionProps(editableScenes, { aspectRatio, fps: 30 });
  }, [editableScenes, aspectRatio]);

  const handleRender = async () => {
    setIsRendering(true);
    setRenderMessage(null);

    try {
      const response = await fetch('/api/render/remotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          scenes: editableScenes,
          aspectRatio,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setRenderMessage(error.error || '渲染失敗，請稍後再試。');
      } else {
        const result = await response.json();
        setRenderMessage(`已輸出影片：${result.path}`);
      }
    } catch (error) {
      console.error('[Remotion] render error:', error);
      setRenderMessage('渲染失敗，請查看控制台錯誤。');
    } finally {
      setIsRendering(false);
    }
  };

  const playerShellStyle = {
    aspectRatio: `${remotionProps.width} / ${remotionProps.height}`,
    maxHeight: '70vh',
  } as const;

  const renderPlayer = (className?: string) => (
    <Player
      component={Composition}
      inputProps={remotionProps}
      durationInFrames={remotionProps.totalFrames}
      compositionWidth={remotionProps.width}
      compositionHeight={remotionProps.height}
      fps={remotionProps.fps}
      controls
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );

  return (
    <div className="space-y-6">
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
            <div className="text-white">
              <h2 className="text-lg font-semibold">{projectName}</h2>
              <p className="text-xs text-slate-400">
                {editableScenes.length} 場景 · {aspectRatio}
              </p>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg transition-colors"
            >
              關閉
            </button>
          </div>
          <div className="flex-1 min-h-0 p-4">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-full max-w-6xl" style={{ aspectRatio: `${remotionProps.width} / ${remotionProps.height}` }}>
                {renderPlayer("rounded-xl overflow-hidden border border-slate-700")}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Remotion 時間軸預覽
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {editableScenes.length} 場景 · {remotionProps.totalFrames} 幀
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  aspectRatio === ratio
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {ratio}
              </button>
            ))}
            <Button variant="outline" onClick={() => setIsFullscreen(true)}>
              <Maximize2 className="w-4 h-4 mr-2" />
              全螢幕
            </Button>
            <Button onClick={handleRender} disabled={isRendering}>
              <Download className="w-4 h-4 mr-2" />
              {isRendering ? '渲染中...' : '渲染輸出'}
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <div
            className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black"
            style={playerShellStyle}
          >
            {renderPlayer("w-full h-full")}
          </div>
        </div>

        {renderMessage && (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            {renderMessage}
          </div>
        )}
      </div>

      <RemotionTimeline scenes={editableScenes} onScenesChange={setEditableScenes} />

      <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
          場景縮圖
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {editableScenes.map((scene, index) => (
            <div key={scene.id} className="rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
              <div className="aspect-video bg-slate-200 dark:bg-slate-700">
                {scene.generatedVideo?.url ? (
                  <video
                    src={scene.generatedVideo.url}
                    className="w-full h-full object-cover"
                    muted
                  />
                ) : scene.generatedImage?.url ? (
                  <img
                    src={scene.generatedImage.url}
                    alt={`場景 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    {index + 1}
                  </div>
                )}
              </div>
              <div className="p-2 text-xs text-slate-600 dark:text-slate-300 truncate">
                場景 {scene.sceneNumber}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
