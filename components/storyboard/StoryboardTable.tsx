'use client';

import { Scene } from '@/lib/types/storyboard';
import { SceneRow } from './SceneRow';

interface StoryboardTableProps {
  scenes: Scene[];
  onUpdateScene: (sceneId: string, updates: Partial<Scene>) => void;
  onDeleteScene: (sceneId: string) => void;
}

export function StoryboardTable({ scenes, onUpdateScene, onDeleteScene }: StoryboardTableProps) {
  if (scenes.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">尚未生成分鏡腳本</p>
          <p className="mt-2 text-sm">請在上方輸入故事需求並生成</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-5 dark:border-slate-700 dark:from-slate-900/60 dark:to-slate-800/40">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">分鏡腳本</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              已生成 {scenes.length} 個場景，可逐場編輯內容與轉場設定
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
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                轉場
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
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
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
