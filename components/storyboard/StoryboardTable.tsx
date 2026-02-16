'use client';

import { useRef, useState } from 'react';
import { Scene } from '@/lib/types/storyboard';
import { SceneRow } from './SceneRow';

interface StoryboardTableProps {
  scenes: Scene[];
  onUpdateScene: (sceneId: string, updates: Partial<Scene>) => void;
  onDeleteScene: (sceneId: string) => void;
  onRegenerateScene?: (sceneId: string) => void;
  onDuplicateScene?: (sceneId: string) => void;
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
      <div className="border-b border-border/70 bg-gradient-to-r from-white/80 via-slate-50/70 to-white/70 px-6 py-5 dark:from-slate-900/60 dark:to-slate-800/40">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-kicker">Storyboard Table</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">分鏡腳本</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              已生成 {scenes.length} 個場景，可逐場編輯內容與轉場設定{onReorderScenes ? '，可拖拉排序' : ''}
            </p>
          </div>
          <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {scenes.length} Scenes
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1150px] w-full">
          <thead className="bg-slate-100/80 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                場景
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                描述
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                鏡頭運動
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                對話/旁白
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                時長
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                首尾幀
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap">
                轉場
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 whitespace-nowrap">
                操作
              </th>
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
