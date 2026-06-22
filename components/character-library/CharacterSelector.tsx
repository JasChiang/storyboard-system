'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Search, Check, Sparkles, Layers3, Flag, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { characterLibraryStorage } from '@/lib/db/character-library-storage';
import { resolveCharacterViewPreviewUrl } from '@/lib/types/character-library';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import type { ProjectReference } from '@/lib/types/storyboard';
import { CHARACTER_STATUS_LABELS, REFERENCE_USAGE_ROLE_LABELS, type ReferenceUsageRole } from '@/lib/characters/workflow';

type CharacterAngle = 'front' | 'side' | 'side_left' | 'side_right' | 'three_quarter' | 'back' | 'top' | 'other';

interface CharacterSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (references: ProjectReference[]) => void;
  selectedIds?: string[];
}

interface CharacterSelectionState {
  angle: CharacterAngle;
  isAnchor: boolean;
  usageRole: ReferenceUsageRole;
}

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'character', label: '角色' },
  { value: 'product', label: '商品' },
  { value: 'environment', label: '環境' },
  { value: 'style', label: '風格' },
] as const;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '全部狀態' },
  { value: 'draft', label: '草稿' },
  { value: 'reviewed', label: '已審核' },
  { value: 'production_ready', label: '可投產' },
  { value: 'archived', label: '封存' },
] as const;

const TYPE_LABELS: Record<CharacterLibraryItem['type'], string> = {
  character: '角色',
  product: '商品',
  environment: '環境',
  style: '風格',
};

const TYPE_COLORS: Record<CharacterLibraryItem['type'], string> = {
  character: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  product: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  environment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  style: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const STATUS_COLORS: Record<CharacterLibraryItem['status'], string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  reviewed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  production_ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const ANGLE_LABELS: Record<CharacterAngle, string> = {
  front: '正面',
  side: '側面',
  side_left: '左側',
  side_right: '右側',
  three_quarter: '3/4 側',
  back: '背面',
  top: '頂部',
  other: '其他',
};

function getDefaultSelectionState(character: CharacterLibraryItem): CharacterSelectionState {
  const isAnchorDefault = character.status === 'production_ready' && (character.type === 'character' || character.type === 'product');
  const usageRole: ReferenceUsageRole = character.type === 'style' ? 'style_support' : (isAnchorDefault ? 'anchor' : 'supporting');
  return {
    angle: 'front',
    isAnchor: isAnchorDefault,
    usageRole,
  };
}

export function CharacterSelector({
  isOpen,
  onClose,
  onSelect,
  selectedIds = [],
}: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<CharacterLibraryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | CharacterLibraryItem['type']>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | CharacterLibraryItem['status']>('all');
  const [selectedCharacters, setSelectedCharacters] = useState<Map<string, CharacterSelectionState>>(new Map());
  const [includeAllViews, setIncludeAllViews] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const selectedIdsKey = selectedIds.join(',');

  useEffect(() => {
    if (!isOpen) return;

    const ids = selectedIdsKey ? selectedIdsKey.split(',') : [];

    void (async () => {
      const items = await characterLibraryStorage.getAll();
      setCharacters(items);

      if (ids.length > 0) {
        const preselected = new Map<string, CharacterSelectionState>();
        ids.forEach((id) => {
          const item = items.find((candidate) => candidate.id === id);
          if (item) preselected.set(id, getDefaultSelectionState(item));
        });
        setSelectedCharacters(preselected);
      } else {
        setSelectedCharacters(new Map());
      }
    })();
  }, [isOpen, selectedIdsKey]);

  const filteredCharacters = characters.filter((character) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = query === ''
      || character.name.toLowerCase().includes(query)
      || (character.tags ?? []).some((tag) => tag.toLowerCase().includes(query));

    const matchesType = filterType === 'all' || character.type === filterType;
    const matchesStatus = filterStatus === 'all' || character.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const selectedCharacterItems = useMemo(
    () => characters.filter((character) => selectedCharacters.has(character.id)),
    [characters, selectedCharacters]
  );

  const estimatedReferenceCount = useMemo(() => {
    if (selectedCharacters.size === 0) return 0;
    if (!includeAllViews) return selectedCharacters.size;
    return selectedCharacterItems.reduce((sum, character) => sum + character.views.length, 0);
  }, [includeAllViews, selectedCharacters.size, selectedCharacterItems]);

  const anchorCount = useMemo(
    () => Array.from(selectedCharacters.values()).filter((item) => item.isAnchor).length,
    [selectedCharacters]
  );

  const handleToggleCharacter = (character: CharacterLibraryItem) => {
    const next = new Map(selectedCharacters);
    if (next.has(character.id)) {
      next.delete(character.id);
    } else {
      next.set(character.id, getDefaultSelectionState(character));
    }
    setSelectedCharacters(next);
  };

  const updateSelection = (characterId: string, updater: (current: CharacterSelectionState) => CharacterSelectionState) => {
    const current = selectedCharacters.get(characterId);
    if (!current) return;
    const next = new Map(selectedCharacters);
    next.set(characterId, updater(current));
    setSelectedCharacters(next);
  };

  const handleSelectFiltered = () => {
    const next = new Map(selectedCharacters);
    filteredCharacters.forEach((character) => {
      if (!next.has(character.id)) next.set(character.id, getDefaultSelectionState(character));
    });
    setSelectedCharacters(next);
  };

  const handleConfirm = async () => {
    if (selectedCharacters.size === 0 || isResolving) return;

    setIsResolving(true);
    setResolveError(null);

    try {
      const selections = Array.from(selectedCharacters.entries()).map(([id, state]) => ({
        id,
        angle: state.angle,
        isAnchor: state.isAnchor,
        usageRole: state.isAnchor ? 'anchor' : state.usageRole,
      }));
      const response = await fetch('/api/data/character-library/resolve-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selections,
          includeAllViews,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || '角色參考圖刷新失敗');
      }

      const references = Array.isArray(payload.references)
        ? (payload.references as ProjectReference[])
        : [];

      if (references.length === 0) {
        throw new Error('沒有可用的角色參考圖，可能原始連結已失效。');
      }

      selections.forEach(({ id }) => {
        void characterLibraryStorage.incrementUsage(id);
      });

      onSelect(references);
      setSelectedCharacters(new Map());
      setSearchQuery('');
      setIncludeAllViews(false);
      onClose();
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : '角色參考圖刷新失敗');
    } finally {
      setIsResolving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="surface-panel flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden border border-white/90 dark:border-white/10">
        <div className="flex items-start justify-between border-b border-border/70 px-6 py-5">
          <div>
            <p className="text-kicker">Character Picker</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">從角色庫加入參考</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              加入前先決定 quality status、anchor role / usage role，continuity draft 會直接吃這層資訊。
            </p>
          </div>
          <button onClick={onClose} className="rounded-full border border-border/70 bg-white/70 p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 dark:bg-slate-900/65 dark:text-slate-300" aria-label="關閉">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 border-b border-border/70 px-6 py-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="surface-inset px-3 py-2"><p className="text-xs text-slate-500">資料庫角色</p><p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{characters.length}</p></div>
            <div className="surface-inset px-3 py-2"><p className="text-xs text-slate-500">目前已選</p><p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedCharacters.size}</p></div>
            <div className="surface-inset px-3 py-2"><p className="text-xs text-slate-500">Anchor roles</p><p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{anchorCount}</p></div>
            <div className="surface-inset px-3 py-2"><p className="text-xs text-slate-500">預估匯入參考張數</p><p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{estimatedReferenceCount}</p></div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="搜尋角色名稱或標籤..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-xl border border-border/80 bg-white/75 py-2.5 pl-10 pr-4 text-sm text-foreground shadow-[0_10px_24px_-18px_rgba(15,23,42,0.55)] backdrop-blur-lg focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button key={option.value} onClick={() => setFilterType(option.value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${filterType === option.value ? 'border-primary/20 bg-primary text-primary-foreground shadow-[0_14px_24px_-18px_hsl(var(--primary)/0.95)]' : 'border-border/70 bg-white/65 text-slate-700 hover:border-primary/30 hover:text-primary dark:bg-slate-900/60 dark:text-slate-300'}`}>
                {option.label}
              </button>
            ))}
            <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as typeof filterStatus)} className="ml-auto rounded-full border border-border/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
              {STATUS_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button onClick={handleSelectFiltered} disabled={filteredCharacters.length === 0} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/60 dark:text-slate-200"><Layers3 className="h-3.5 w-3.5" />全選目前結果</button>
            <button onClick={() => setSelectedCharacters(new Map())} disabled={selectedCharacters.size === 0} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/60 dark:text-slate-200">清空已選</button>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={includeAllViews} onChange={(event) => setIncludeAllViews(event.target.checked)} className="h-4 w-4 rounded border-slate-300 dark:border-slate-600" />
            每個角色自動帶入全部視角（保留同一個 anchor / usage role）
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {filteredCharacters.length === 0 ? (
            <div className="surface-soft py-14 text-center"><Sparkles className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{searchQuery || filterType !== 'all' || filterStatus !== 'all' ? '沒有符合條件的角色' : '角色庫尚未建立內容'}</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredCharacters.map((character) => {
                const isSelected = selectedCharacters.has(character.id);
                const selectedState = selectedCharacters.get(character.id) || getDefaultSelectionState(character);
                const previewView = character.views.find((view) => view.angle === selectedState.angle) || character.views[0];

                return (
                  <div key={character.id} className={`surface-soft cursor-pointer overflow-hidden border transition-all ${isSelected ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border/70 hover:-translate-y-0.5 hover:border-primary/25'}`} onClick={() => handleToggleCharacter(character)}>
                    <div className="flex gap-4 p-4">
                      {previewView && (
                        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900">
                          <img src={resolveCharacterViewPreviewUrl(previewView)} alt={character.name} className="h-full w-full object-cover" />
                          {isSelected && <div className="absolute inset-0 flex items-center justify-center bg-primary/22"><div className="rounded-full bg-primary p-1"><Check className="h-4 w-4 text-primary-foreground" /></div></div>}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{character.name}</h3>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${TYPE_COLORS[character.type]}`}>{TYPE_LABELS[character.type]}</span>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${STATUS_COLORS[character.status]}`}>{CHARACTER_STATUS_LABELS[character.status]}</span>
                          </div>
                        </div>

                        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{character.description}</p>

                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{character.views.length} 視角</span>
                          <span>•</span>
                          <span>{character.tags?.length ?? 0} 標籤</span>
                          <span>•</span>
                          <span>使用 {character.usageCount} 次</span>
                        </div>

                        {isSelected && (
                          <div className="mt-3 space-y-3 rounded-xl border border-primary/15 bg-primary/5 p-3" onClick={(event) => event.stopPropagation()}>
                            {character.views.length > 1 && !includeAllViews && (
                              <div className="flex flex-wrap gap-1.5">
                                {character.views.map((view) => (
                                  <button key={view.angle} onClick={() => updateSelection(character.id, (current) => ({ ...current, angle: view.angle }))} className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${selectedState.angle === view.angle ? 'bg-primary text-primary-foreground' : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'}`}>
                                    {ANGLE_LABELS[view.angle]}
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                              <label className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                <span className="inline-flex items-center gap-1 font-medium"><Flag className="h-3.5 w-3.5" />專案角色</span>
                                <select
                                  value={selectedState.isAnchor ? 'anchor' : selectedState.usageRole}
                                  onChange={(event) => {
                                    const nextRole = event.target.value as ReferenceUsageRole;
                                    updateSelection(character.id, (current) => ({
                                      ...current,
                                      isAnchor: nextRole === 'anchor',
                                      usageRole: nextRole === 'anchor' ? 'anchor' : nextRole,
                                    }));
                                  }}
                                  className="w-full rounded-lg border border-border/70 bg-white/80 px-2.5 py-2 text-xs dark:bg-slate-900/70"
                                >
                                  {(character.type === 'character' || character.type === 'product' || character.type === 'environment') && <option value="anchor">Anchor role（主錨點）</option>}
                                  <option value="supporting">Usage role（一般使用）</option>
                                  {character.type === 'style' && <option value="style_support">Style support（風格支援）</option>}
                                </select>
                              </label>
                              <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                <span className="inline-flex items-center gap-1 font-medium"><ShieldCheck className="h-3.5 w-3.5" />進 draft 的提示</span>
                                <p className="rounded-lg border border-border/70 bg-white/70 px-2.5 py-2 leading-5 dark:bg-slate-900/60">
                                  {selectedState.isAnchor ? '會優先寫入 anchor continuity 指令。' : `會以 ${REFERENCE_USAGE_ROLE_LABELS[selectedState.usageRole]} 進入 continuity draft。`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-6 py-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">已準備加入 {estimatedReferenceCount} 張參考圖，其中 {anchorCount} 個 anchor role</p>
            {resolveError && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{resolveError}</p>}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={isResolving}>取消</Button>
            <Button onClick={handleConfirm} disabled={selectedCharacters.size === 0 || isResolving}>{isResolving ? '刷新 Fal 連結中...' : `確認加入 (${selectedCharacters.size})`}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
