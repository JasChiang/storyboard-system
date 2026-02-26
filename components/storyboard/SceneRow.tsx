'use client';

import { useState, useRef, useEffect } from 'react';
import { Scene, TransitionType, type TransitionToNext } from '@/lib/types/storyboard';
import { Pencil, Trash2, Check, X, Copy, Star, RotateCcw, MoreHorizontal, RefreshCw, Loader2, Plus } from 'lucide-react';

interface SceneRowProps {
  scene: Scene;
  onUpdate: (updates: Partial<Scene>) => void;
  onDelete: () => void;
  onRegenerate?: () => void;
  onDuplicate?: () => void;
  onInsertAfter?: () => void;
  onResetScene?: () => void;
  isRegenerating?: boolean;
  isDraggable?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}

// 根據場景描述推斷景別
function inferShotType(description: string): string | null {
  const lower = description.toLowerCase();
  if (/extreme\s*close[-\s]?up|極端特寫|超特寫/i.test(lower)) return 'ECU';
  if (/close[-\s]?up|特寫|近景/i.test(lower)) return 'CU';
  if (/medium\s*shot|中景|半身/i.test(lower)) return 'MS';
  if (/wide\s*shot|全景|大全景/i.test(lower)) return 'WS';
  if (/extreme\s*wide|超遠景|全場景/i.test(lower)) return 'EWS';
  return null;
}

function parseTagList(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const normalized = value.replace(/^<|>$/g, '').trim();
      return normalized ? `<${normalized}>` : '';
    })
    .filter(Boolean);
}

function stringifyTagList(values?: string[]): string {
  if (!Array.isArray(values) || values.length === 0) return '';
  return values.join(', ');
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

// QA 狀態設定
const QA_CONFIG = {
  block: { label: '阻擋', className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300' },
  warn: { label: '警告', className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300' },
  pass: { label: '通過', className: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300' },
};

export function SceneRow({
  scene,
  onUpdate,
  onDelete,
  onRegenerate,
  onDuplicate,
  onInsertAfter,
  onResetScene,
  isRegenerating = false,
  isDraggable,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: SceneRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScene, setEditedScene] = useState(scene);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // 點擊外部關閉 more menu
  useEffect(() => {
    if (!showMore) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMore]);

  useEffect(() => {
    setEditedScene(scene);
  }, [scene]);

  const handleSave = () => {
    onUpdate(editedScene);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedScene(scene);
    setIsEditing(false);
  };

  const handleTransitionChange = (type: TransitionType) => {
    const nextTransition: TransitionToNext = {
      ...editedScene.transitionToNext,
      type,
      useEndFrameAsNextStart: type === 'continuation',
      continuitySourceMode: type === 'continuation'
        ? (editedScene.transitionToNext?.continuitySourceMode || 'auto')
        : 'none',
    };
    const updates = {
      ...editedScene,
      transitionToNext: nextTransition,
    };
    setEditedScene(updates);
  };

  const handleCopyPrompt = () => {
    const text = [scene.description, scene.cameraMovement, scene.dialogue].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    setShowMore(false);
  };

  if (isEditing) {
    return (
      <tr
        className="bg-slate-100/70 dark:bg-slate-900/55"
        draggable={isDraggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <td className="px-4 py-3">
          <div className="inline-flex rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-slate-900 dark:text-blue-300">
            #{scene.sceneNumber}
          </div>
        </td>
        <td className="px-4 py-3">
          <textarea
            className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.description}
            onChange={(e) => setEditedScene({ ...editedScene, description: e.target.value })}
            rows={3}
          />
          <div className="mt-2 grid gap-2">
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={editedScene.sceneIntent || ''}
              onChange={(e) => setEditedScene({ ...editedScene, sceneIntent: e.target.value })}
              placeholder="sceneIntent：此鏡頭敘事目的"
              rows={2}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={editedScene.shotIntent || ''}
              onChange={(e) => setEditedScene({ ...editedScene, shotIntent: e.target.value })}
              placeholder="shotIntent：鏡頭任務"
              rows={2}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={editedScene.startComposition || ''}
              onChange={(e) => setEditedScene({ ...editedScene, startComposition: e.target.value })}
              placeholder="startComposition：首幀構圖錨點"
              rows={2}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={editedScene.subjectMotion || ''}
              onChange={(e) => setEditedScene({ ...editedScene, subjectMotion: e.target.value })}
              placeholder="subjectMotion：主體動作邊界"
              rows={2}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={editedScene.continuityLock || ''}
              onChange={(e) => setEditedScene({ ...editedScene, continuityLock: e.target.value })}
              placeholder="continuityLock：不可變連續性"
              rows={2}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={editedScene.continuityAnchor || ''}
              onChange={(e) => setEditedScene({ ...editedScene, continuityAnchor: e.target.value })}
              placeholder="continuityAnchor：跨鏡頭錨點"
              rows={2}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={editedScene.changeFromPrev || ''}
              onChange={(e) => setEditedScene({ ...editedScene, changeFromPrev: e.target.value })}
              placeholder="changeFromPrev：相對上一鏡差異"
              rows={2}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={stringifyTagList(editedScene.charactersUsed)}
              onChange={(e) => setEditedScene({ ...editedScene, charactersUsed: parseTagList(e.target.value) })}
              placeholder="charactersUsed：<Alice>, <Bob>"
              rows={1}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={stringifyTagList(editedScene.productsUsed)}
              onChange={(e) => setEditedScene({ ...editedScene, productsUsed: parseTagList(e.target.value) })}
              placeholder="productsUsed：<ProductX>"
              rows={1}
            />
            <textarea
              className="w-full rounded-lg border border-border/60 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={stringifyTagList(editedScene.requiredReferences)}
              onChange={(e) => setEditedScene({ ...editedScene, requiredReferences: parseTagList(e.target.value) })}
              placeholder="requiredReferences：<Alice>, <ProductX>"
              rows={1}
            />
          </div>
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.cameraMovement}
            onChange={(e) => setEditedScene({ ...editedScene, cameraMovement: e.target.value })}
          />
        </td>
        <td className="px-4 py-3">
          <textarea
            className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.dialogue}
            onChange={(e) => setEditedScene({ ...editedScene, dialogue: e.target.value })}
            rows={2}
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            className="w-24 rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
            value={editedScene.duration}
            onChange={(e) => {
              const parsed = Number.parseFloat(e.target.value);
              setEditedScene({ ...editedScene, duration: Number.isFinite(parsed) ? parsed : 0 });
            }}
            step="0.1"
          />
        </td>
        <td className="px-4 py-3">
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={editedScene.requiresEndFrame || false}
                onChange={(e) => {
                  const nextChecked = e.target.checked;
                  setEditedScene({
                    ...editedScene,
                    requiresEndFrame: nextChecked,
                    endFrameDescription: nextChecked ? (editedScene.endFrameDescription || editedScene.description) : '',
                    endFrameDelta: nextChecked ? (editedScene.endFrameDelta || '') : '',
                  });
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              需要尾幀
            </label>
            {editedScene.requiresEndFrame && (
              <div className="space-y-1">
                <textarea
                  className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
                  value={editedScene.endFrameDescription || ''}
                  onChange={(e) => setEditedScene({ ...editedScene, endFrameDescription: e.target.value })}
                  placeholder="尾幀完整描述"
                  rows={2}
                />
                <textarea
                  className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-xs shadow-[0_8px_18px_-14px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
                  value={editedScene.endFrameDelta || ''}
                  onChange={(e) => setEditedScene({ ...editedScene, endFrameDelta: e.target.value })}
                  placeholder="尾幀差異（只寫相對首幀改變）"
                  rows={2}
                />
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="space-y-2">
            <select
              className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-sm shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
              value={editedScene.transitionToNext?.type || 'dissolve'}
              onChange={(e) => handleTransitionChange(e.target.value as TransitionType)}
            >
              {Object.entries(TRANSITION_LABELS).map(([type, { label, icon }]) => (
                <option key={type} value={type}>
                  {icon} {label}
                </option>
              ))}
            </select>
            {(editedScene.transitionToNext?.type === 'continuation') && (
              <select
                className="w-full rounded-lg border border-border/80 bg-white/75 px-3 py-2 text-xs shadow-[0_10px_22px_-16px_rgba(15,23,42,0.45)] outline-none transition focus:border-primary/35 focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/70"
                value={editedScene.transitionToNext?.continuitySourceMode || 'auto'}
                onChange={(e) => setEditedScene({
                  ...editedScene,
                  transitionToNext: {
                    ...editedScene.transitionToNext,
                    type: 'continuation',
                    useEndFrameAsNextStart: true,
                    continuitySourceMode: e.target.value as TransitionToNext['continuitySourceMode'],
                  },
                })}
              >
                <option value="auto">來源: 自動（尾優先，無尾改首）</option>
                <option value="previous_end_only">來源: 只用上一景尾幀</option>
                <option value="previous_start_only">來源: 只用上一景首幀</option>
                <option value="none">來源: 不沿用（僅保留轉場語意）</option>
              </select>
            )}
          </div>
          {editedScene.transitionToNext?.reason && (
            <div className="mt-1 line-clamp-2 text-xs text-slate-500">
              {editedScene.transitionToNext.reason}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg border border-green-200 bg-green-100 p-1.5 text-green-700 transition hover:bg-green-200 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40"
              title="保存"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancel}
              className="rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-slate-700 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              title="取消"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const transitionType = scene.transitionToNext?.type || 'dissolve';
  const transitionInfo = TRANSITION_LABELS[transitionType];
  const shotType = inferShotType(scene.description);

  const retentionRiskDot: Record<string, string> = {
    low: 'bg-green-400',
    medium: 'bg-amber-400',
    high: 'bg-red-500',
  };

  // 組合 QA tooltip 文字
  const qaTooltip = scene.qaIssues?.length
    ? scene.qaIssues.join('\n')
    : undefined;

  return (
    <tr
      id={`scene-row-${scene.id}`}
      className={`border-b border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-slate-700 dark:hover:bg-slate-700/40 ${isDragOver ? 'outline outline-2 outline-blue-400 outline-offset-[-2px]' : ''} ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* 場景號 + 景別 + QA + retentionRisk */}
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col items-start gap-1.5">
          <div className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            #{scene.sceneNumber}
          </div>
          {shotType && (
            <span className="inline-flex rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-mono font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {shotType}
            </span>
          )}
          {scene.retentionRisk && (
            <span
              className={`inline-block h-2 w-2 rounded-full ${retentionRiskDot[scene.retentionRisk]}`}
              title={`流失風險: ${scene.retentionRisk}`}
            />
          )}
          {/* QA badge 移至場景號欄，hover 顯示詳情 */}
          {scene.qaStatus && (
            <span
              className={`inline-flex rounded border px-1.5 py-0.5 text-xs font-medium cursor-help ${QA_CONFIG[scene.qaStatus].className}`}
              title={qaTooltip || `QA ${QA_CONFIG[scene.qaStatus].label}`}
            >
              QA
            </span>
          )}
        </div>
      </td>

      {/* 描述 + hookScore（僅保留主要資訊，移除 QA 和 notes 的 inline 展示） */}
      <td className="px-4 py-3 align-top">
        <div className="max-w-md text-sm leading-6 text-slate-800 dark:text-slate-100">
          {scene.description}
        </div>
        {scene.hookScore && (
          <div className="mt-1.5 flex items-center gap-1" title={scene.hookScoreReason || `Hook 強度 ${scene.hookScore}/5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className={`h-3.5 w-3.5 ${i < scene.hookScore! ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`}
              />
            ))}
            <span className="ml-1 text-xs text-muted-foreground">Hook {scene.hookScore}</span>
          </div>
        )}
        {/* 一致性警告保留（inline 但 line-clamp-1） */}
        {scene.consistencyWarnings && scene.consistencyWarnings.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {scene.consistencyWarnings.map((w, i) => (
              <div key={i} className="text-xs text-rose-600 dark:text-rose-400">⚠ {w}</div>
            ))}
          </div>
        )}
        <div className="mt-2 space-y-1.5">
          {scene.sceneIntent && (
            <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
              sceneIntent: {scene.sceneIntent}
            </p>
          )}
          {scene.shotIntent && (
            <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
              shotIntent: {scene.shotIntent}
            </p>
          )}
          {scene.startComposition && (
            <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
              startComposition: {scene.startComposition}
            </p>
          )}
          {(scene.charactersUsed?.length || scene.productsUsed?.length || scene.requiredReferences?.length) && (
            <div className="flex flex-wrap gap-1">
              {(scene.charactersUsed || []).map((tag) => (
                <span key={`c-${tag}`} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {tag}
                </span>
              ))}
              {(scene.productsUsed || []).map((tag) => (
                <span key={`p-${tag}`} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {tag}
                </span>
              ))}
              {(scene.requiredReferences || []).map((tag) => (
                <span key={`r-${tag}`} className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  必用 {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-3 align-top">
        <div className="max-w-[220px] rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {scene.cameraMovement}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="max-w-xs text-sm text-slate-700 dark:text-slate-200">
          {scene.dialogue || <span className="text-slate-400 dark:text-slate-500">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {scene.duration}秒
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        {scene.requiresEndFrame ? (
          <div className="space-y-1.5">
            <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              ✓ 首尾幀
            </span>
            {scene.endFrameDescription && (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                尾幀: {scene.endFrameDescription}
              </div>
            )}
            {scene.endFrameDelta && (
              <div className="text-xs text-violet-600 dark:text-violet-300">
                差異: {scene.endFrameDelta}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-600">—</span>
        )}
      </td>

      {/* 轉場欄：badge + reason inline */}
      <td className="px-4 py-3 align-top">
        <div className="space-y-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap ${transitionInfo.color}`}
          >
            {transitionInfo.icon} {transitionInfo.label}
          </span>
          {scene.transitionToNext?.reason && (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {scene.transitionToNext.reason}
            </div>
          )}
          {(scene.transitionToNext?.useEndFrameAsNextStart || scene.transitionToNext?.type === 'continuation') && (
            <div className="text-xs font-medium text-green-600 dark:text-green-400">
              → 延續至下一幕
            </div>
          )}
          {scene.transitionToNext?.type === 'continuation' && scene.transitionToNext?.continuitySourceMode && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              來源模式：
              {scene.transitionToNext.continuitySourceMode === 'auto' && '自動（尾優先）'}
              {scene.transitionToNext.continuitySourceMode === 'previous_end_only' && '只用尾幀'}
              {scene.transitionToNext.continuitySourceMode === 'previous_start_only' && '只用首幀'}
              {scene.transitionToNext.continuitySourceMode === 'none' && '不沿用'}
            </div>
          )}
        </div>
      </td>

      {/* 操作欄：3 主要按鈕 + ... more */}
      <td className="px-4 py-3 align-top whitespace-nowrap">
        <div className="flex items-center gap-1">
          {/* 主要：編輯 */}
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-blue-200 bg-blue-100 p-1.5 text-blue-700 transition hover:bg-blue-200 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40"
            title="編輯"
          >
            <Pencil className="h-4 w-4" />
          </button>

          {/* 主要：刪除 */}
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-200 bg-red-100 p-1.5 text-red-700 transition hover:bg-red-200 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40"
            title="刪除"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          {/* 主要：重生 */}
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isRegenerating}
              className="rounded-lg border border-indigo-200 bg-indigo-100 p-1.5 text-indigo-700 transition hover:bg-indigo-200 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/40"
              title="重生此場景"
            >
              {isRegenerating
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
            </button>
          )}

          {/* ... 更多選項 */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setShowMore(prev => !prev)}
              className="rounded-lg border border-slate-200 bg-slate-100 p-1.5 text-slate-600 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              title="更多操作"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showMore && (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border/60 bg-white shadow-lg dark:bg-slate-800">
                {onDuplicate && (
                  <button
                    onClick={() => { onDuplicate(); setShowMore(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    複製場景
                  </button>
                )}
                {onInsertAfter && (
                  <button
                    onClick={() => { onInsertAfter(); setShowMore(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    下方插入場景
                  </button>
                )}
                <button
                  onClick={handleCopyPrompt}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                  複製 Prompt
                </button>
                {onResetScene && (
                  <button
                    onClick={() => { onResetScene(); setShowMore(false); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-900/20"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    重置生成
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
