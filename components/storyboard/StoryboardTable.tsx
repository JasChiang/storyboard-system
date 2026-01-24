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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-12">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <p className="text-lg">尚未生成分鏡腳本</p>
          <p className="text-sm mt-2">請在上方輸入故事需求並生成</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold">分鏡腳本表格</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          共 {scenes.length} 個場景
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                場景
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                描述
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                鏡頭運動
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                對話/旁白
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                時長
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
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
