'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string, videoType?: string, targetDurationSec?: number) => void;
}

const VIDEO_TYPES = [
  { id: 'commercial', label: '商業廣告', desc: '產品宣傳、品牌形象', emoji: '📺' },
  { id: 'unboxing', label: '產品開箱', desc: '開箱評測、功能展示', emoji: '📦' },
  { id: 'brand_story', label: '品牌故事', desc: '企業文化、創始故事', emoji: '🎬' },
  { id: 'shorts_hook', label: 'Shorts Viral', desc: '病毒式短影片', emoji: '⚡' },
  { id: 'documentary', label: '紀錄片', desc: '深度記錄、真實故事', emoji: '🎥' },
];

const DURATION_OPTIONS = [
  { sec: 15, label: '15 秒', sceneEst: '3-4 場景' },
  { sec: 20, label: '20 秒', sceneEst: '4-5 場景' },
  { sec: 25, label: '25 秒', sceneEst: '5 場景' },
  { sec: 30, label: '30 秒', sceneEst: '5-6 場景' },
  { sec: 60, label: '60 秒', sceneEst: '7 場景' },
];

export function CreateProjectDialog({ isOpen, onClose, onCreate }: CreateProjectDialogProps) {
  const [step, setStep] = useState(1);
  const [videoType, setVideoType] = useState('');
  const [targetDurationSec, setTargetDurationSec] = useState(30);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const reset = () => {
    setStep(1);
    setVideoType('');
    setTargetDurationSec(30);
    setName('');
    setDescription('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim() || undefined, videoType || undefined, targetDurationSec);
    reset();
    onClose();
  };

  if (!isOpen) return null;

  const stepLabels = ['影片類型', '目標時長', '核心資訊', '確認建立'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog */}
      <div className="surface-hero relative w-full max-w-xl p-7 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-kicker">New Project</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">建立新專案</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-2">
          {stepLabels.map((label, i) => {
            const stepNum = i + 1;
            const isDone = step > stepNum;
            const isActive = step === stepNum;
            return (
              <div key={stepNum} className="flex items-center gap-2">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  isDone ? 'bg-primary text-primary-foreground' :
                  isActive ? 'bg-primary text-primary-foreground' :
                  'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}>
                  {isDone ? <Check className="h-3 w-3" /> : stepNum}
                </div>
                <span className={`text-xs ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
                {i < stepLabels.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Video Type */}
        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">選擇影片類型，系統會自動選用最適合的模板。</p>
            <div className="grid grid-cols-1 gap-2">
              {VIDEO_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setVideoType(type.id)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
                    videoType === type.id
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border/60 hover:border-border bg-white/50 dark:bg-slate-900/50'
                  }`}
                >
                  <span className="text-xl">{type.emoji}</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.desc}</p>
                  </div>
                  {videoType === type.id && (
                    <Check className="ml-auto h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setStep(2)} disabled={!videoType}>
                下一步
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Duration */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">選擇目標影片時長，系統會按此規劃場景數量。</p>
            <div className="grid grid-cols-1 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.sec}
                  onClick={() => setTargetDurationSec(opt.sec)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                    targetDurationSec === opt.sec
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border/60 hover:border-border bg-white/50 dark:bg-slate-900/50'
                  }`}
                >
                  <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">估算 {opt.sceneEst}</span>
                    {targetDurationSec === opt.sec && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一步
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                下一步
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Core Info */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground">填寫專案基本資訊。</p>
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
                    setStep(4);
                  }
                }}
                autoFocus
              />
            </div>
            <Textarea
              label="專案描述（可選）"
              placeholder="簡單描述這個專案的目標..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一步
              </Button>
              <Button onClick={() => setStep(4)} disabled={!name.trim()} className="flex-1">
                下一步
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">確認以下資訊後建立專案。</p>
            <div className="rounded-xl border border-border/60 bg-slate-50/50 dark:bg-slate-900/50 p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">影片類型</span>
                <span className="font-medium">{VIDEO_TYPES.find(t => t.id === videoType)?.label || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">目標時長</span>
                <span className="font-medium">{targetDurationSec} 秒</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">專案名稱</span>
                <span className="font-medium">{name}</span>
              </div>
              {description && (
                <div>
                  <span className="text-muted-foreground">描述</span>
                  <p className="mt-1 text-foreground line-clamp-2">{description}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                上一步
              </Button>
              <Button onClick={handleSubmit} className="flex-1">
                建立專案
                <Check className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
