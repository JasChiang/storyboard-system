'use client';

import { useMemo, useRef, useState } from 'react';
import { X, Plus, Sparkles, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fal } from '@fal-ai/client';
import type { ProjectReference } from '@/lib/types/storyboard';
import { buildStructuredIdentityLock } from '@/lib/references/identity-lock';

interface ProjectReferenceUploaderProps {
  references: ProjectReference[];
  onChange: (refs: ProjectReference[]) => void;
  disabled?: boolean;
}

const TYPE_OPTIONS = [
  { value: 'character', label: '角色', hint: '角色外觀、服裝' },
  { value: 'product', label: '商品', hint: '產品外觀、材質' },
  { value: 'environment', label: '環境', hint: '場景、背景' },
  { value: 'style', label: '風格', hint: '視覺風格參考' },
] as const;

const ANGLE_OPTIONS = [
  { value: 'front', label: '正面', emoji: '⬛' },
  { value: 'side', label: '側面', emoji: '◼️' },
  { value: 'three_quarter', label: '3/4 側', emoji: '📐' },
  { value: 'back', label: '背面', emoji: '⬜' },
  { value: 'top', label: '頂部', emoji: '🔼' },
  { value: 'other', label: '其他', emoji: '⚪' },
] as const;

const TYPE_BADGE_STYLES = {
  character: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  product: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  environment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
} as const;

export function ProjectReferenceUploader({
  references,
  onChange,
  disabled,
}: ProjectReferenceUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [editingRef, setEditingRef] = useState<ProjectReference | null>(null);
  const [isDescribing, setIsDescribing] = useState(false);
  const [userNote, setUserNote] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const typeCounts = useMemo(() => {
    return TYPE_OPTIONS.map((option) => ({
      ...option,
      count: references.filter((reference) => reference.type === option.value).length,
    }));
  }, [references]);

  const aiGeneratedCount = useMemo(
    () => references.filter((reference) => reference.descriptionSource === 'ai').length,
    [references]
  );

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片檔案');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('圖片檔案過大，請上傳小於 10MB 的圖片');
      return;
    }

    setIsUploading(true);

    try {
      const uploadedUrl = await fal.storage.upload(file);
      const newReference: ProjectReference = {
        id: crypto.randomUUID(),
        url: uploadedUrl,
        description: '',
        type: 'product',
        angle: 'front',
        descriptionSource: 'manual',
      };

      setEditingRef(newReference);
      setUserNote('');
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : '上傳失敗');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAIDescribe = async () => {
    if (!editingRef) return;

    setIsDescribing(true);

    try {
      const imageBase64 = await fetch(editingRef.url)
        .then((response) => response.blob())
        .then((blob) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        });

      const response = await fetch('/api/openrouter/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          angle: editingRef.angle || 'front',
          type: editingRef.type,
          userNote: userNote.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'AI 分析失敗');
      }

      setEditingRef({
        ...editingRef,
        description: data.description,
        aiDescription: data.description,
        mustKeepFeatures: data.analysis?.mustKeep || [],
        identityCore: data.analysis?.identityCore,
        styleTraits: data.analysis?.styleTraits,
        angleVisibility: data.analysis?.angleVisibility,
        guidelines: data.analysis?.mustKeep?.length
          ? `不可改變：${data.analysis.mustKeep.join('；')}`
          : editingRef.guidelines,
        structuredIdentityLock: buildStructuredIdentityLock({
          type: editingRef.type,
          description: data.description,
          identityCore: data.analysis?.identityCore,
          mustKeepFeatures: data.analysis?.mustKeep || [],
          guidelines: data.analysis?.mustKeep?.length
            ? `不可改變：${data.analysis.mustKeep.join('；')}`
            : editingRef.guidelines,
        }),
        descriptionSource: 'ai',
      });
    } catch (error) {
      console.error('AI describe error:', error);
      alert(error instanceof Error ? error.message : 'AI 分析失敗');
    } finally {
      setIsDescribing(false);
    }
  };

  const handleSaveRef = () => {
    if (!editingRef || !editingRef.description.trim()) {
      alert('請輸入描述');
      return;
    }

    onChange([...references, editingRef]);
    setEditingRef(null);
    setUserNote('');
  };

  const handleRemoveRef = (id: string) => {
    onChange(references.filter((reference) => reference.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
          專案參考圖 (選填)
        </label>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          共 {references.length} 張
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="surface-inset px-3 py-2">
          <p className="text-xs text-slate-500">已分析 AI 描述</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{aiGeneratedCount}</p>
        </div>
        {typeCounts.slice(0, 2).map((item) => (
          <div key={item.value} className="surface-inset px-3 py-2">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{item.count}</p>
          </div>
        ))}
      </div>

      {references.length > 0 && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
          {references.map((reference) => (
            <div
              key={reference.id}
              className="surface-soft group relative overflow-hidden border border-border/70"
            >
              <img
                src={reference.url}
                alt={reference.description}
                className="h-24 w-full object-cover"
              />
              <div className="space-y-1 p-2.5">
                <div className="flex flex-wrap items-center gap-1">
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${TYPE_BADGE_STYLES[reference.type]}`}>
                    {TYPE_OPTIONS.find((item) => item.value === reference.type)?.label}
                  </span>
                  {reference.name && (
                    <span className="text-[11px] text-slate-500">&lt;{reference.name}&gt;</span>
                  )}
                  {reference.descriptionSource === 'ai' && (
                    <Sparkles className="h-3 w-3 text-amber-500" />
                  )}
                </div>
                {reference.angle && (
                  <span className="inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {ANGLE_OPTIONS.find((angle) => angle.value === reference.angle)?.emoji} {ANGLE_OPTIONS.find((angle) => angle.value === reference.angle)?.label}
                  </span>
                )}
                <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                  {reference.description}
                </p>
              </div>

              <button
                onClick={() => handleRemoveRef(reference.id)}
                disabled={disabled}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="刪除參考圖"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {editingRef && (
        <div className="surface-panel space-y-4 border border-primary/20 p-4">
          <div className="grid gap-3 md:grid-cols-[120px,1fr]">
            <img
              src={editingRef.url}
              alt="New reference"
              className="h-[120px] w-[120px] rounded-xl object-cover"
            />

            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setEditingRef({ ...editingRef, type: option.value })}
                    className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                      editingRef.type === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {(editingRef.type === 'product' || editingRef.type === 'character') && (
                <div>
                  <label className="mb-1 block text-xs text-slate-500">視角</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ANGLE_OPTIONS.map((angle) => (
                      <button
                        key={angle.value}
                        onClick={() => setEditingRef({ ...editingRef, angle: angle.value })}
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                          editingRef.angle === angle.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {angle.emoji} {angle.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(editingRef.type === 'character' || editingRef.type === 'product') && (
                <input
                  type="text"
                  placeholder={editingRef.type === 'character' ? '角色名稱（如 Alice）' : '商品名稱（如 iPhone）'}
                  value={editingRef.name || ''}
                  onChange={(event) => setEditingRef({ ...editingRef, name: event.target.value })}
                  className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
                />
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">參考說明（讓 AI 有上下文）</label>
            <input
              type="text"
              placeholder="例如：冷冽金屬質地、品牌 logo 請保留在左上角"
              value={userNote}
              onChange={(event) => setUserNote(event.target.value)}
              className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">描述</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAIDescribe}
                disabled={isDescribing}
              >
                {isDescribing ? (
                  <>
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    分析中
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    AI 自動描述
                  </>
                )}
              </Button>
            </div>
            <textarea
              value={editingRef.description}
              onChange={(event) => setEditingRef({
                ...editingRef,
                description: event.target.value,
                descriptionSource: 'manual',
              })}
              placeholder={
                editingRef.type === 'character'
                  ? '描述角色外觀、服裝、姿勢、視角...'
                  : editingRef.type === 'product'
                    ? '描述商品外觀、材質、細節、視角...'
                    : editingRef.type === 'environment'
                      ? '描述場景、光線、氛圍...'
                      : '描述視覺風格、色調...'
              }
              className="w-full resize-none rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditingRef(null)}>
              取消
            </Button>
            <Button size="sm" onClick={handleSaveRef} disabled={!editingRef.description.trim()}>
              確認新增
            </Button>
          </div>
        </div>
      )}

      {!editingRef && (
        <label
          className={`surface-soft flex min-h-28 cursor-pointer items-center justify-center gap-2 border border-dashed border-border/80 text-slate-500 transition-colors hover:border-primary/40 hover:text-primary ${
            disabled || isUploading ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">上傳中...</span>
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span className="text-sm">新增參考圖</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={disabled || isUploading}
          />
        </label>
      )}

      {references.length === 0 && !editingRef && (
        <div className="surface-soft px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="inline-flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5" />
            上傳角色或場景參考圖，後續圖片與影片會更穩定。
          </div>
        </div>
      )}
    </div>
  );
}
