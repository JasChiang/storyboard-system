'use client';

import { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { keys: ['j', 'k'], description: '切換場景（下一個 / 上一個）' },
  { keys: ['↑', '↓'], description: '切換場景（上一個 / 下一個）' },
  { keys: ['?'], description: '切換快捷鍵說明面板' },
  { keys: ['Esc'], description: '關閉彈窗 / 預覽播放器' },
];

export function KeyboardShortcutSheet({ isOpen, onClose }: KeyboardShortcutSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="surface-hero relative w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">快捷鍵說明</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {shortcuts.map((shortcut, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">{shortcut.description}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {shortcut.keys.map((key, ki) => (
                  <span key={ki} className="inline-flex items-center justify-center rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-mono font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {key}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-xs text-muted-foreground">按 <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 font-mono dark:border-slate-700 dark:bg-slate-800">?</kbd> 再次切換此面板</p>
      </div>
    </div>
  );
}
