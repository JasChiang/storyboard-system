'use client';

import { useEffect, useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/lib/prompts';
import { estimatePromptBudget, formatBudgetLabel } from '@/lib/prompts/prompt-budget';
import { detectTemplateConflicts } from '@/lib/storyboard/template-conflict';
import { AlertTriangle, Info, Loader2, Plus, Users } from 'lucide-react';
import { ProjectReferenceUploader } from './ProjectReferenceUploader';
import { CharacterSelector } from '@/components/character-library/CharacterSelector';
import { CharacterCreateDialog } from '@/components/character-library/CharacterCreateDialog';
import { characterLibraryStorage } from '@/lib/db/character-library-storage';
import { characterLibraryItemToProjectReference } from '@/lib/types/character-library';
import type { ProjectReference } from '@/lib/types/storyboard';

interface StoryPromptInputProps {
  onGenerate: (
    prompt: string,
    templateId: string,
    references: ProjectReference[],
    targetDurationSec: number,
    targetSceneCount?: number
  ) => Promise<void>;
  isLoading: boolean;
  initialTargetDurationSec?: number;
  initialPrompt?: string;
}

const DURATION_OPTIONS = [
  { value: '15', label: '15 秒（約 3 場）' },
  { value: '20', label: '20 秒（約 4 場）' },
  { value: '25', label: '25 秒（約 5 場）' },
  { value: '30', label: '30 秒（約 6 場）' },
  { value: '60', label: '其他' },
];

const VALID_DURATION_VALUES = new Set(DURATION_OPTIONS.map((option) => option.value));

function normalizeDurationValue(value?: number): string {
  if (value && VALID_DURATION_VALUES.has(String(value))) return String(value);
  return '30';
}

function normalizePromptValue(value?: string): string {
  return typeof value === 'string' ? value : '';
}

export function StoryPromptInput({
  onGenerate,
  isLoading,
  initialTargetDurationSec,
  initialPrompt,
}: StoryPromptInputProps) {
  const [prompt, setPrompt] = useState(() => normalizePromptValue(initialPrompt));
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [targetDurationSec, setTargetDurationSec] = useState(() => normalizeDurationValue(initialTargetDurationSec));
  const [manualSceneCount, setManualSceneCount] = useState('');
  const [references, setReferences] = useState<ProjectReference[]>([]);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [showCreateCharacterDialog, setShowCreateCharacterDialog] = useState(false);

  useEffect(() => {
    setTargetDurationSec(normalizeDurationValue(initialTargetDurationSec));
  }, [initialTargetDurationSec]);

  useEffect(() => {
    if (!initialPrompt) return;
    setPrompt((prev) => (prev.trim() ? prev : initialPrompt));
  }, [initialPrompt]);

  useEffect(() => {
    if (targetDurationSec !== '60') {
      setManualSceneCount('');
    }
  }, [targetDurationSec]);

  const mergeUniqueReferences = (base: ProjectReference[], incoming: ProjectReference[]) => {
    const merged = [...base];
    const seen = new Set(
      base.map((ref) => `${ref.type}:${ref.name || ''}:${ref.angle || ''}:${ref.url}`)
    );

    incoming.forEach((ref) => {
      const key = `${ref.type}:${ref.name || ''}:${ref.angle || ''}:${ref.url}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(ref);
    });

    return merged;
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    const parsedSceneCount = Number(manualSceneCount);
    const hasManualSceneCount = manualSceneCount.trim().length > 0;
    if (hasManualSceneCount && (!Number.isInteger(parsedSceneCount) || parsedSceneCount < 7)) {
      alert('若要指定超過 6 場，請輸入 7 以上整數；否則留空即可。');
      return;
    }

    await onGenerate(
      prompt,
      templateId,
      references,
      Number(targetDurationSec),
      hasManualSceneCount ? parsedSceneCount : undefined
    );
  };

  const handleSelectFromLibrary = (newReferences: ProjectReference[]) => {
    // 合並角色庫選擇的角色和已有的暫時上傳
    setReferences((prev) => mergeUniqueReferences(prev, newReferences));
  };

  const handleCreateToLibrary = async (character: Parameters<typeof characterLibraryStorage.add>[0]) => {
    const created = await characterLibraryStorage.add(character);
    // 建立後先預設帶入正面視角，讓使用者可立即使用
    const reference = characterLibraryItemToProjectReference(created, 'front');
    setReferences(prev => mergeUniqueReferences(prev, [reference]));
    setShowCreateCharacterDialog(false);
  };

  const templateOptions = TEMPLATES.map(t => ({
    value: t.id,
    label: t.name
  }));
  const selectedTemplate = TEMPLATES.find(t => t.id === templateId);
  const useManualSceneCount = targetDurationSec === '60';

  const manualSceneCountValue = useMemo(() => {
    const parsed = Number(manualSceneCount);
    return manualSceneCount.trim().length > 0 && Number.isFinite(parsed) ? parsed : undefined;
  }, [manualSceneCount]);

  const templateWarnings = useMemo(
    () => detectTemplateConflicts({
      templateId,
      targetDurationSec: Number(targetDurationSec) || 30,
      manualSceneCount: manualSceneCountValue,
      references,
    }),
    [templateId, targetDurationSec, manualSceneCountValue, references]
  );

  const promptBudget = useMemo(
    () => estimatePromptBudget({ userPrompt: prompt, references }),
    [prompt, references]
  );
  const referenceTagSummary = useMemo(() => {
    const grouped = new Map<string, { label: string; count: number; hasAi: boolean }>();

    references.forEach((ref) => {
      const key = ref.name ? `name:${ref.name}` : `type:${ref.type}`;
      const roleLabel = ref.isAnchor ? 'anchor' : (ref.usageRole || 'usage');
      const label = ref.name ? `<${ref.name}> · ${roleLabel}` : `${ref.type} · ${roleLabel}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.count += 1;
        existing.hasAi = existing.hasAi || ref.descriptionSource === 'ai';
        return;
      }
      grouped.set(key, {
        label,
        count: 1,
        hasAi: ref.descriptionSource === 'ai',
      });
    });

    return Array.from(grouped.values());
  }, [references]);

  return (
    <div className="surface-panel p-6">
      <p className="text-kicker">故事輸入</p>
      <h2 className="mb-4 mt-2 text-2xl font-semibold tracking-tight">故事需求輸入</h2>

      <div className="space-y-4">
        <Select
          label="分鏡模板"
          options={templateOptions}
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        />
        <Select
          label="目標影片長度"
          options={DURATION_OPTIONS}
          value={targetDurationSec}
          onChange={(e) => setTargetDurationSec(e.target.value)}
        />
        {useManualSceneCount && (
          <div className="space-y-1.5 rounded-xl border border-border/60 bg-white/55 p-3 dark:bg-slate-900/45">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              目標場景數（選填）
            </label>
            <input
              type="number"
              min={7}
              step={1}
              value={manualSceneCount}
              onChange={(e) => setManualSceneCount(e.target.value)}
              placeholder="留空使用預設（<= 6 場）"
              className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm text-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
            />
            <p className="text-xs text-muted-foreground">
              超過 6 場請手動輸入（7 以上整數）；留空則由系統按時長用 3-6 場規劃。
            </p>
          </div>
        )}

        {selectedTemplate && (
          <div className="surface-inset border border-primary/15 p-3">
            <p className="text-sm text-primary dark:text-sky-200">
              {selectedTemplate.description}
            </p>
          </div>
        )}

        {templateWarnings.length > 0 && (
          <div className="space-y-2">
            {templateWarnings.map((warning, idx) => {
              const Icon = warning.level === 'warn' ? AlertTriangle : Info;
              const tone = warning.level === 'warn'
                ? 'border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200'
                : 'border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-900/20 dark:text-sky-200';
              return (
                <div key={idx} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${tone}`}>
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>{warning.message}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* 參考圖管理 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              參考圖片（選填）
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCharacterSelector(true)}
                disabled={isLoading}
              >
                <Users className="w-4 h-4 mr-2" />
                從角色庫選擇
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateCharacterDialog(true)}
                disabled={isLoading}
              >
                <Plus className="w-4 h-4 mr-2" />
                新增到角色庫
              </Button>
            </div>
          </div>

          <ProjectReferenceUploader
            references={references}
            onChange={setReferences}
            disabled={isLoading}
          />
        </div>

        {/* 參考圖提示 */}
        {references.length > 0 && (
          <div className="surface-inset border border-emerald-200/60 p-3 dark:border-emerald-500/25">
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              ✅ 已設定 {references.length} 張參考圖。錨點 / 使用角色會一起送進連戲草稿，AI 生成的分鏡描述會使用 &lt;角色名&gt; 或 &lt;商品名&gt; 格式標記，不會重複描述外觀。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {referenceTagSummary.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-300/70 bg-white px-2.5 py-1 text-xs dark:border-emerald-500/30 dark:bg-slate-900/60"
                >
                  {item.label}
                  {item.count > 1 && ` ×${item.count}`}
                  {item.hasAi && ' 🤖'}
                </span>
              ))}
            </div>
          </div>
        )}

        <Textarea
          label="故事描述"
          placeholder="請描述您的故事內容、場景、角色、情節等..."
          rows={8}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />

        <div className="space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              '生成分鏡腳本'
            )}
          </Button>
          <p
            className={`text-center text-xs ${
              promptBudget.level === 'danger'
                ? 'text-red-600 dark:text-red-300'
                : promptBudget.level === 'warn'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-muted-foreground'
            }`}
            title={`使用者故事 ${promptBudget.breakdown.userPrompt} 字・參考圖 ${promptBudget.breakdown.references} 字・模板約 ${promptBudget.breakdown.templateBase} 字`}
          >
            {formatBudgetLabel(promptBudget)}
          </p>
        </div>
      </div>

      {/* 角色庫選擇器 */}
      <CharacterSelector
        isOpen={showCharacterSelector}
        onClose={() => setShowCharacterSelector(false)}
        onSelect={handleSelectFromLibrary}
      />

      <CharacterCreateDialog
        isOpen={showCreateCharacterDialog}
        onClose={() => setShowCreateCharacterDialog(false)}
        onSave={handleCreateToLibrary}
      />
    </div>
  );
}
