'use client';

import { useState } from 'react';
import type { Scene } from '@/lib/types/storyboard';

interface PacingTimelineProps {
  scenes: Scene[];
  onSceneClick?: (sceneId: string) => void;
}

const hookScoreColor: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-400',
  3: 'bg-yellow-400',
  4: 'bg-green-400',
  5: 'bg-emerald-500',
};

const retentionRiskBorder: Record<string, string> = {
  low: 'border-green-300 dark:border-green-700',
  medium: 'border-amber-300 dark:border-amber-700',
  high: 'border-red-300 dark:border-red-700',
};

export function PacingTimeline({ scenes, onSceneClick }: PacingTimelineProps) {
  const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);

  if (scenes.length === 0) return null;

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 0), 0);

  return (
    <div className="surface-soft rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-kicker">Pacing Timeline</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">節奏時間軸</p>
        </div>
        <div className="text-xs text-muted-foreground">
          總時長 {totalDuration.toFixed(1)} 秒
        </div>
      </div>

      <div className="relative flex h-10 w-full overflow-hidden rounded-lg border border-border/40">
        {scenes.map((scene) => {
          const widthPct = totalDuration > 0 ? ((scene.duration || 0) / totalDuration) * 100 : 100 / scenes.length;
          const colorClass = scene.hookScore ? hookScoreColor[scene.hookScore] : 'bg-slate-300 dark:bg-slate-600';
          const borderClass = scene.retentionRisk ? retentionRiskBorder[scene.retentionRisk] : 'border-slate-200 dark:border-slate-700';
          const isHovered = hoveredSceneId === scene.id;

          return (
            <button
              key={scene.id}
              style={{ width: `${widthPct}%` }}
              className={`relative flex h-full flex-shrink-0 cursor-pointer items-center justify-center border-r text-xs font-bold text-white transition-all ${colorClass} ${borderClass} ${isHovered ? 'brightness-110' : ''} last:border-r-0`}
              onClick={() => onSceneClick?.(scene.id)}
              onMouseEnter={() => setHoveredSceneId(scene.id)}
              onMouseLeave={() => setHoveredSceneId(null)}
              title={[
                `場景 ${scene.sceneNumber}`,
                `${scene.duration}秒`,
                scene.hookScore ? `Hook: ${scene.hookScore}/5` : '',
                scene.retentionRisk ? `流失風險: ${scene.retentionRisk}` : '',
                scene.hookScoreReason || '',
              ].filter(Boolean).join('\n')}
            >
              {widthPct > 8 ? `#${scene.sceneNumber}` : ''}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> Hook 1
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-400" /> 2
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-400" /> 3
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-400" /> 4
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> 5
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> 未評分
        </span>
      </div>

      {/* Tooltip display */}
      {hoveredSceneId && (() => {
        const scene = scenes.find(s => s.id === hoveredSceneId);
        if (!scene) return null;
        return (
          <div className="mt-2 rounded-lg border border-border/50 bg-white/90 px-3 py-2 text-xs dark:bg-slate-900/90">
            <span className="font-semibold">場景 {scene.sceneNumber}</span>
            {scene.hookScore && (
              <span className="ml-2 text-muted-foreground">Hook {scene.hookScore}/5</span>
            )}
            {scene.hookScoreReason && (
              <p className="mt-0.5 text-muted-foreground">{scene.hookScoreReason}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
