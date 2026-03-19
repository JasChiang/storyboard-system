'use client';

import { useMemo, useState } from 'react';
import type { StyleProfile } from '@/lib/types/storyboard';
import {
  DEFAULT_STYLE_PROFILE_ID,
  PRESET_STYLE_PROFILES,
} from '@/lib/constants/style-profiles';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronDown, ChevronUp, Palette, Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StyleProfileSelectorProps {
  selectedProfileId?: string;
  customProfiles?: StyleProfile[];
  onChange: (nextProfileId: string) => void;
  onCustomProfilesChange: (profiles: StyleProfile[]) => void;
  disabled?: boolean;
}

export function StyleProfileSelector({
  selectedProfileId,
  customProfiles = [],
  onChange,
  onCustomProfilesChange,
  disabled,
}: StyleProfileSelectorProps) {
  const [newProfileName, setNewProfileName] = useState('');
  const [newStylePrompt, setNewStylePrompt] = useState('');
  const [newNegativePrompt, setNewNegativePrompt] = useState('');
  const [isPickerExpanded, setIsPickerExpanded] = useState(false);
  const [isCustomFormExpanded, setIsCustomFormExpanded] = useState(false);

  const allProfiles = useMemo(
    () => [...PRESET_STYLE_PROFILES, ...customProfiles],
    [customProfiles]
  );

  const activeProfileId = selectedProfileId || DEFAULT_STYLE_PROFILE_ID;
  const activeProfile =
    allProfiles.find((profile) => profile.id === activeProfileId) ||
    PRESET_STYLE_PROFILES[0];

  const handleCreateCustomProfile = () => {
    if (!newProfileName.trim() || !newStylePrompt.trim()) {
      alert('請至少填寫 Profile 名稱與風格描述');
      return;
    }

    const nextProfile: StyleProfile = {
      id: `custom-style-${Date.now()}`,
      name: newProfileName.trim(),
      stylePrompt: newStylePrompt.trim(),
      negativePrompt: newNegativePrompt.trim() || undefined,
      isPreset: false,
    };

    const nextCustomProfiles = [...customProfiles, nextProfile];
    onCustomProfilesChange(nextCustomProfiles);
    onChange(nextProfile.id);

    setNewProfileName('');
    setNewStylePrompt('');
    setNewNegativePrompt('');
    setIsCustomFormExpanded(false);
  };

  return (
    <div className="surface-soft space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-kicker">Style Direction</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Preset Picker
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            用 production-ready 風格模板鎖住整批畫面語言，避免每個 scene 各自漂走。
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Palette className="h-3.5 w-3.5" />
          {activeProfile.isPreset ? 'Preset' : 'Custom'}
        </Badge>
      </div>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => setIsPickerExpanded((prev) => !prev)}
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-white/70 px-4 py-3 text-left transition hover:bg-slate-50 disabled:opacity-60 dark:bg-slate-900/60 dark:hover:bg-slate-800/70"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Preset Picker</p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">目前使用：{activeProfile.name}</p>
          </div>
          {isPickerExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </button>

        {isPickerExpanded && (
          <div className="grid gap-3 lg:grid-cols-2">
            {allProfiles.map((profile) => {
            const isActive = profile.id === activeProfileId;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => onChange(profile.id)}
                disabled={disabled}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200',
                  'bg-white/80 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.55)] dark:bg-slate-900/70',
                  isActive
                    ? 'border-primary/40 ring-2 ring-primary/15 shadow-[0_20px_44px_-28px_rgba(37,99,235,0.35)]'
                    : 'border-border/70 hover:-translate-y-0.5 hover:border-primary/25',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400/70 via-violet-400/70 to-cyan-300/70" />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {profile.name}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          'h-5 px-1.5 py-0 text-[10px]',
                          profile.isPreset
                            ? 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-900/20 dark:text-sky-300'
                            : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-900/20 dark:text-violet-300'
                        )}
                      >
                        {profile.isPreset ? 'Preset' : 'Custom'}
                      </Badge>
                    </div>
                    {profile.usage && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {profile.usage}
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                      isActive
                        ? 'border-primary/40 bg-primary text-primary-foreground'
                        : 'border-border/70 bg-white/80 text-slate-400 dark:bg-slate-950/60'
                    )}
                  >
                    {isActive ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.defaultRenderLane && (
                    <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px]">
                      lane {profile.defaultRenderLane}
                    </Badge>
                  )}
                  {profile.recommendedStages?.slice(0, 3).map((stage) => (
                    <Badge key={stage} variant="outline" className="h-5 px-1.5 py-0 text-[10px]">
                      {stage}
                    </Badge>
                  ))}
                </div>
              </button>
            );
            })}
          </div>
        )}

        <div className="surface-inset min-w-0 space-y-3 break-words p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Active preset
              </p>
              <h4 className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                {activeProfile.name}
              </h4>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              {activeProfile.isPreset ? 'Built-in' : 'Custom'}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {activeProfile.usage && (
              <Badge className="bg-cyan-500/12 text-cyan-700 dark:text-cyan-300">{activeProfile.usage}</Badge>
            )}
            {activeProfile.defaultRenderLane && (
              <Badge variant="outline">lane {activeProfile.defaultRenderLane}</Badge>
            )}
            {activeProfile.recommendedStages?.map((stage) => (
              <Badge key={stage} variant="outline">{stage}</Badge>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Summary</p>
            <p className="mt-1 break-words text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {activeProfile.continuityStrategy || activeProfile.productionPreset || activeProfile.stylePrompt}
            </p>
          </div>

          {isPickerExpanded && activeProfile.productionPreset && (
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Production preset</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {activeProfile.productionPreset}
              </p>
            </div>
          )}

          {isPickerExpanded && activeProfile.continuityStrategy && (
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Continuity strategy</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {activeProfile.continuityStrategy}
              </p>
            </div>
          )}

          {isPickerExpanded && (
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Style prompt</p>
              <p className="mt-1 break-words text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {activeProfile.stylePrompt}
              </p>
            </div>
          )}

          {isPickerExpanded && activeProfile.negativePrompt && (
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Negative guardrails</p>
              <p className="mt-1 break-words text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {activeProfile.negativePrompt}
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setIsCustomFormExpanded((prev) => !prev)}
        disabled={disabled}
        className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline disabled:opacity-60"
      >
        <Plus className="h-3.5 w-3.5" />
        新增自訂模板
      </button>

      {isCustomFormExpanded && (
        <div className="surface-inset grid gap-3 p-4 lg:grid-cols-2">
          <div className="space-y-3 lg:col-span-2">
            <input
              type="text"
              placeholder="Profile 名稱（例如：Brand Clay Promo）"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              disabled={disabled}
              className="w-full rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 dark:bg-slate-900/70"
            />
          </div>
          <textarea
            placeholder="風格描述（必填）"
            value={newStylePrompt}
            onChange={(e) => setNewStylePrompt(e.target.value)}
            disabled={disabled}
            rows={4}
            className="w-full resize-none rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 dark:bg-slate-900/70"
          />
          <textarea
            placeholder="限制事項（選填，建議 3-6 條）"
            value={newNegativePrompt}
            onChange={(e) => setNewNegativePrompt(e.target.value)}
            disabled={disabled}
            rows={4}
            className="w-full resize-none rounded-xl border border-border/80 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 dark:bg-slate-900/70"
          />
          <div className="lg:col-span-2">
            <button
              onClick={handleCreateCustomProfile}
              disabled={disabled}
              className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              儲存自訂模板
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
