'use client';

import { useState } from 'react';
import { Scene, TransitionType } from '@/lib/types/storyboard';
import { Pencil, Trash2, Check, X } from 'lucide-react';

interface SceneRowProps {
  scene: Scene;
  onUpdate: (updates: Partial<Scene>) => void;
  onDelete: () => void;
}

// 轉場類型顯示設定
const TRANSITION_LABELS: Record<TransitionType, { label: string; color: string; icon: string }> = {
  cut: { label: '硬切', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: '✂️' },
  dissolve: { label: '溶解', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', icon: '🔀' },
  fade_black: { label: '黑場', color: 'bg-gray-800 text-white dark:bg-gray-900 dark:text-gray-100', icon: '⬛' },
  fade_white: { label: '白場', color: 'bg-gray-100 text-gray-700 dark:bg-gray-200 dark:text-gray-800', icon: '⬜' },
  continuation: { label: '延續', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: '🔗' },
  match_cut: { label: '匹配', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', icon: '🎯' },
  wipe: { label: '擦除', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', icon: '➡️' },
  push: { label: '推出', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: '📤' },
};

export function SceneRow({ scene, onUpdate, onDelete }: SceneRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScene, setEditedScene] = useState(scene);

  const handleSave = () => {
    onUpdate(editedScene);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedScene(scene);
    setIsEditing(false);
  };

  const handleTransitionChange = (type: TransitionType) => {
    const updates = {
      ...editedScene,
      transitionToNext: {
        ...editedScene.transitionToNext,
        type,
        // 自動設定 continuation 的相關選項
        useEndFrameAsNextStart: type === 'continuation',
      },
    };
    // 如果選擇 continuation，自動勾選 requiresEndFrame
    if (type === 'continuation') {
      updates.requiresEndFrame = true;
    }
    setEditedScene(updates);
  };

  if (isEditing) {
    return (
      <tr className="bg-blue-50 dark:bg-blue-900/10">
        <td className="px-4 py-3">
          <div className="font-semibold text-blue-600 dark:text-blue-400">
            #{scene.sceneNumber}
          </div>
        </td>
        <td className="px-4 py-3">
          <textarea
            className="w-full px-2 py-1 border rounded text-sm"
            value={editedScene.description}
            onChange={(e) => setEditedScene({ ...editedScene, description: e.target.value })}
            rows={3}
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            className="w-full px-2 py-1 border rounded text-sm"
            value={editedScene.cameraMovement}
            onChange={(e) => setEditedScene({ ...editedScene, cameraMovement: e.target.value })}
          />
        </td>
        <td className="px-4 py-3">
          <textarea
            className="w-full px-2 py-1 border rounded text-sm"
            value={editedScene.dialogue}
            onChange={(e) => setEditedScene({ ...editedScene, dialogue: e.target.value })}
            rows={2}
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            className="w-20 px-2 py-1 border rounded text-sm"
            value={editedScene.duration}
            onChange={(e) => setEditedScene({ ...editedScene, duration: parseFloat(e.target.value) })}
            step="0.1"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={editedScene.requiresEndFrame || false}
              onChange={(e) => setEditedScene({ ...editedScene, requiresEndFrame: e.target.checked })}
              className="rounded"
            />
            {editedScene.requiresEndFrame && (
              <textarea
                className="w-full px-2 py-1 border rounded text-xs"
                value={editedScene.endFrameDescription || ''}
                onChange={(e) => setEditedScene({ ...editedScene, endFrameDescription: e.target.value })}
                placeholder="尾幀描述"
                rows={2}
              />
            )}
          </div>
        </td>
        {/* 轉場編輯 */}
        <td className="px-4 py-3">
          <select
            className="w-full px-2 py-1 border rounded text-sm"
            value={editedScene.transitionToNext?.type || 'dissolve'}
            onChange={(e) => handleTransitionChange(e.target.value as TransitionType)}
          >
            {Object.entries(TRANSITION_LABELS).map(([type, { label, icon }]) => (
              <option key={type} value={type}>
                {icon} {label}
              </option>
            ))}
          </select>
          {editedScene.transitionToNext?.reason && (
            <div className="text-xs text-slate-500 mt-1 line-clamp-2">
              {editedScene.transitionToNext.reason}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
              title="保存"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              title="取消"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const transitionType = scene.transitionToNext?.type || 'dissolve';
  const transitionInfo = TRANSITION_LABELS[transitionType];

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
      <td className="px-4 py-3">
        <div className="font-semibold text-blue-600 dark:text-blue-400">
          #{scene.sceneNumber}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm max-w-md">
          {scene.description}
        </div>
        {scene.notes && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            備註: {scene.notes}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="text-sm">{scene.cameraMovement}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm max-w-xs">{scene.dialogue}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-mono">{scene.duration}秒</div>
      </td>
      <td className="px-4 py-3">
        {scene.requiresEndFrame ? (
          <div className="space-y-1">
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
              ✓ 首尾幀
            </span>
            {scene.endFrameDescription && (
              <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xs line-clamp-2" title={scene.endFrameDescription}>
                尾幀: {scene.endFrameDescription}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
        )}
      </td>
      {/* 轉場顯示 */}
      <td className="px-4 py-3">
        <div className="space-y-1">
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${transitionInfo.color}`}>
            {transitionInfo.icon} {transitionInfo.label}
          </span>
          {scene.transitionToNext?.useEndFrameAsNextStart && (
            <div className="text-xs text-green-600 dark:text-green-400">
              → 延續至下一幕
            </div>
          )}
          {scene.transitionToNext?.reason && (
            <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xs line-clamp-2" title={scene.transitionToNext.reason}>
              {scene.transitionToNext.reason}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            title="編輯"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
            title="刪除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

