'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X } from 'lucide-react';

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => void;
}

export function CreateProjectDialog({ isOpen, onClose, onCreate }: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="surface-hero relative w-full max-w-xl p-7 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-kicker">New Project</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">建立新專案</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
              專案名稱 *
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-border/80 bg-white/75 px-3.5 py-2.5 text-sm text-foreground shadow-[0_12px_24px_-18px_rgba(15,23,42,0.5)] backdrop-blur-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 dark:bg-slate-900/65"
              placeholder="例：產品宣傳影片"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && name.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              autoFocus
            />
          </div>

          <Textarea
            label="專案描述（可選）"
            placeholder="簡單描述這個專案的目標..."
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="flex-1"
            >
              建立專案
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
