'use client';

import { useRef, useState } from 'react';
import { Scene } from '@/lib/types/storyboard';
import { SceneRow } from './SceneRow';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GripVertical, Plus, Rows3, ShieldAlert, Sparkles } from 'lucide-react';

interface StoryboardTableProps {
  scenes: Scene[];
  onUpdateScene: (sceneId: string, updates: Partial<Scene>) => void;
  onDeleteScene: (sceneId: string) => void;
  onRegenerateScene?: (sceneId: string) => void;
  onDuplicateScene?: (sceneId: string) => void;
  onInsertSceneAfter?: (sceneId: string) => void;
  onAppendScene?: () => void;
  onResetScene?: (sceneId: string) => void;
  onReorderScenes?: (orderedIds: string[]) => void;
  isRegeneratingSceneId?: string | null;
}

export function StoryboardTable({
  scenes,
  onUpdateScene,
  onDeleteScene,
  onRegenerateScene,
  onDuplicateScene,
  onInsertSceneAfter,
  onAppendScene,
  onResetScene,
  onReorderScenes,
  isRegeneratingSceneId,
}: StoryboardTableProps) {
  const dragSceneId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, sceneId: string) => {
    dragSceneId.current = sceneId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, sceneId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(sceneId);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    const fromId = dragSceneId.current;
    if (!fromId || fromId === targetId || !onReorderScenes) return;

    const ids = scenes.map(s => s.id);
    const fromIndex = ids.indexOf(fromId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...ids];
    reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, fromId);
    onReorderScenes(reordered);
  };

  const handleDragEnd = () => {
    dragSceneId.current = null;
    setDragOverId(null);
  };

  const qaBlocked = scenes.filter((scene) => scene.qaStatus === 'block').length;
  const qaWarn = scenes.filter((scene) => scene.qaStatus === 'warn').length;
  const endFrameCount = scenes.filter((scene) => scene.requiresEndFrame).length;

  if (scenes.length === 0) {
    return (
      <div className="surface-panel p-12">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">尚未生成分鏡腳本</p>
          <p className="mt-2 text-sm">請在上方輸入故事需求並生成</p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-panel overflow-hidden">
      <div className="border-b border-border/70 bg-gradient-to-r from-white/85 via-slate-50/80 to-white/75 px-6 py-5 dark:from-slate-900/60 dark:to-slate-800/40">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-kicker">Scene List</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Storyboard Scene Breakdown</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              每列都是 production row：上半部看敘事與連戲，下半部看生成與 QA。{onReorderScenes ? '支援拖拉排序，方便先排節奏再微調內容。' : ''}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1.5"><Rows3 className="h-3.5 w-3.5" />{scenes.length} Scenes</Badge>
              <Badge variant="outline" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />{endFrameCount} End-frame scenes</Badge>
              {(qaBlocked > 0 || qaWarn > 0) && (
                <Badge className="gap-1.5 bg-amber-500/12 text-amber-700 dark:text-amber-300"><ShieldAlert className="h-3.5 w-3.5" />{qaBlocked + qaWarn} Need review</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {onReorderScenes && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/70 px-3 py-1 text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                  <GripVertical className="h-3.5 w-3.5" />
                  Drag to reorder
                </div>
              )}
              {onAppendScene && (
                <Button type="button" variant="outline" size="sm" onClick={onAppendScene}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  新增場景
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1360px] w-full table-fixed">
          <thead className="bg-slate-100/80 dark:bg-slate-900/60">
            <tr>
              <th className="w-[110px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Scene</th>
              <th className="w-[620px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Narrative / Continuity / Generation / QA</th>
              <th className="w-[180px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Camera</th>
              <th className="w-[220px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Dialogue</th>
              <th className="w-[100px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Duration</th>
              <th className="w-[190px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">Start / End</th>
              <th className="w-[180px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap">Transition</th>
              <th className="w-[120px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {scenes.map((scene) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                onUpdate={(updates) => onUpdateScene(scene.id, updates)}
                onDelete={() => onDeleteScene(scene.id)}
                onRegenerate={onRegenerateScene ? () => onRegenerateScene(scene.id) : undefined}
                onDuplicate={onDuplicateScene ? () => onDuplicateScene(scene.id) : undefined}
                onInsertAfter={onInsertSceneAfter ? () => onInsertSceneAfter(scene.id) : undefined}
                onResetScene={onResetScene ? () => onResetScene(scene.id) : undefined}
                isRegenerating={isRegeneratingSceneId === scene.id}
                isDragOver={dragOverId === scene.id}
                onDragStart={onReorderScenes ? (e) => handleDragStart(e, scene.id) : undefined}
                onDragOver={onReorderScenes ? (e) => handleDragOver(e, scene.id) : undefined}
                onDrop={onReorderScenes ? (e) => handleDrop(e, scene.id) : undefined}
                onDragEnd={onReorderScenes ? handleDragEnd : undefined}
                isDraggable={!!onReorderScenes}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
