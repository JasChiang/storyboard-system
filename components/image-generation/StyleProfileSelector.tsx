'use client';

import { useMemo, useState } from 'react';
import type { StyleProfile } from '@/lib/types/storyboard';
import {
  DEFAULT_STYLE_PROFILE_ID,
  PRESET_STYLE_PROFILES,
} from '@/lib/constants/style-profiles';

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
  const [isExpanded, setIsExpanded] = useState(false);

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
      alert('請至少填寫 Profile 名稱與 Style Prompt');
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
    setIsExpanded(false);
  };

  return (
    <div className="surface-soft space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Style Profile</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            同一批次固定同一個風格模板，可維持商品與畫面語言一致。
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">選擇風格模板</label>
        <select
          value={activeProfileId}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border border-border/80 bg-white/75 px-3 py-2 text-sm text-slate-900 shadow-[0_10px_20px_-14px_rgba(15,23,42,0.45)] backdrop-blur-lg focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 disabled:opacity-60 dark:bg-slate-900/70 dark:text-slate-200"
        >
          {PRESET_STYLE_PROFILES.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} (Preset)
            </option>
          ))}
          {customProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} (Custom)
            </option>
          ))}
        </select>
      </div>

      <div className="surface-inset space-y-2 p-3">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">目前模板：{activeProfile.name}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{activeProfile.stylePrompt}</p>
        {activeProfile.negativePrompt && (
          <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed">
            Negative: {activeProfile.negativePrompt}
          </p>
        )}
      </div>

      <button
        onClick={() => setIsExpanded((prev) => !prev)}
        disabled={disabled}
        className="text-xs text-primary hover:underline disabled:opacity-60"
      >
        {isExpanded ? '收合自訂模板' : '新增自訂模板'}
      </button>

      {isExpanded && (
        <div className="surface-inset space-y-2 p-3">
          <input
            type="text"
            placeholder="Profile 名稱（例如：Brand Clay Promo）"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-border/80 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 dark:bg-slate-900/70"
          />
          <textarea
            placeholder="Style Prompt（必填）"
            value={newStylePrompt}
            onChange={(e) => setNewStylePrompt(e.target.value)}
            disabled={disabled}
            rows={3}
            className="w-full resize-none rounded-lg border border-border/80 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 dark:bg-slate-900/70"
          />
          <textarea
            placeholder="Negative Prompt（選填）"
            value={newNegativePrompt}
            onChange={(e) => setNewNegativePrompt(e.target.value)}
            disabled={disabled}
            rows={2}
            className="w-full resize-none rounded-lg border border-border/80 bg-white/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary/40 dark:bg-slate-900/70"
          />
          <button
            onClick={handleCreateCustomProfile}
            disabled={disabled}
            className="rounded-full bg-primary px-3 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            儲存自訂模板
          </button>
        </div>
      )}
    </div>
  );
}
