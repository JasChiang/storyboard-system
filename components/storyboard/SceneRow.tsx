'use client';

import { useState } from 'react';
import { Scene } from '@/lib/types/storyboard';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SceneRowProps {
  scene: Scene;
  onUpdate: (updates: Partial<Scene>) => void;
  onDelete: () => void;
}

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
