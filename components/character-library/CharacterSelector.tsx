'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Search, Check, Sparkles, Layers3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { characterLibraryStorage } from '@/lib/db/character-library-storage';
import {
  characterLibraryItemToProjectReference,
  characterLibraryItemToProjectReferences,
  resolveCharacterViewPreviewUrl,
} from '@/lib/types/character-library';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import type { ProjectReference } from '@/lib/types/storyboard';

type CharacterAngle = 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';

interface CharacterSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (references: ProjectReference[]) => void;
  selectedIds?: string[];
}

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'character', label: '角色' },
  { value: 'product', label: '商品' },
  { value: 'environment', label: '環境' },
  { value: 'style', label: '風格' },
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

const ANGLE_LABELS: Record<CharacterAngle, string> = {
  front: '正面',
  side: '側面',
  three_quarter: '3/4 側',
  back: '背面',
  top: '頂部',
  other: '其他',
};

export function CharacterSelector({
  isOpen,
  onClose,
  onSelect,
  selectedIds = [],
}: CharacterSelectorProps) {
  const [characters, setCharacters] = useState<CharacterLibraryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | CharacterLibraryItem['type']>('all');
  const [selectedCharacters, setSelectedCharacters] = useState<Map<string, CharacterAngle>>(new Map());
  const [includeAllViews, setIncludeAllViews] = useState(true);

  const selectedIdsKey = selectedIds.join(',');

  useEffect(() => {
    if (!isOpen) return;

    const ids = selectedIdsKey ? selectedIdsKey.split(',') : [];

    void (async () => {
      const items = await characterLibraryStorage.getAll();
      setCharacters(items);

      if (ids.length > 0) {
        const preselected = new Map<string, CharacterAngle>();
        ids.forEach((id) => {
          if (items.some((item) => item.id === id)) {
            preselected.set(id, 'front');
          }
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
      || character.tags.some((tag) => tag.toLowerCase().includes(query));

    const matchesType = filterType === 'all' || character.type === filterType;
    return matchesSearch && matchesType;
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

  const handleToggleCharacter = (character: CharacterLibraryItem) => {
    const next = new Map(selectedCharacters);
    if (next.has(character.id)) {
      next.delete(character.id);
    } else {
      next.set(character.id, 'front');
    }
    setSelectedCharacters(next);
  };

  const handleChangeAngle = (characterId: string, angle: CharacterAngle) => {
    const next = new Map(selectedCharacters);
    next.set(characterId, angle);
    setSelectedCharacters(next);
  };

  const handleSelectFiltered = () => {
    const next = new Map(selectedCharacters);
    filteredCharacters.forEach((character) => {
      if (!next.has(character.id)) {
        next.set(character.id, 'front');
      }
    });
    setSelectedCharacters(next);
  };

  const handleConfirm = () => {
    const references: ProjectReference[] = [];

    selectedCharacters.forEach((angle, characterId) => {
      const character = characters.find((item) => item.id === characterId);
      if (!character) return;

      try {
        if (includeAllViews) {
          references.push(...characterLibraryItemToProjectReferences(character, 'all'));
        } else {
          references.push(characterLibraryItemToProjectReference(character, angle));
        }
        void characterLibraryStorage.incrementUsage(characterId);
      } catch (error) {
        console.error(`轉換角色 ${character.name} 失敗:`, error);
      }
    });

    onSelect(references);
    setSelectedCharacters(new Map());
    setSearchQuery('');
    setIncludeAllViews(true);
    onClose();
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
              選擇角色後可直接注入分鏡參考，不需要重新上傳素材
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-border/70 bg-white/70 p-2 text-slate-600 transition-colors hover:bg-white hover:text-slate-900 dark:bg-slate-900/65 dark:text-slate-300"
            aria-label="關閉"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 border-b border-border/70 px-6 py-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="surface-inset px-3 py-2">
              <p className="text-xs text-slate-500">資料庫角色</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{characters.length}</p>
            </div>
            <div className="surface-inset px-3 py-2">
              <p className="text-xs text-slate-500">目前已選</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{selectedCharacters.size}</p>
            </div>
            <div className="surface-inset px-3 py-2">
              <p className="text-xs text-slate-500">預估匯入參考張數</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{estimatedReferenceCount}</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜尋角色名稱或標籤..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-border/80 bg-white/75 py-2.5 pl-10 pr-4 text-sm text-foreground shadow-[0_10px_24px_-18px_rgba(15,23,42,0.55)] backdrop-blur-lg focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 dark:bg-slate-900/65"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterType(option.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                  filterType === option.value
                    ? 'border-primary/20 bg-primary text-primary-foreground shadow-[0_14px_24px_-18px_hsl(var(--primary)/0.95)]'
                    : 'border-border/70 bg-white/65 text-slate-700 hover:border-primary/30 hover:text-primary dark:bg-slate-900/60 dark:text-slate-300'
                }`}
              >
                {option.label}
              </button>
            ))}

            <button
              onClick={handleSelectFiltered}
              disabled={filteredCharacters.length === 0}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/60 dark:text-slate-200"
            >
              <Layers3 className="h-3.5 w-3.5" />
              全選目前結果
            </button>
            <button
              onClick={() => setSelectedCharacters(new Map())}
              disabled={selectedCharacters.size === 0}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/60 dark:text-slate-200"
            >
              清空已選
            </button>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeAllViews}
              onChange={(event) => setIncludeAllViews(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
            />
            每個角色自動帶入全部視角（推薦）
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {filteredCharacters.length === 0 ? (
            <div className="surface-soft py-14 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                {searchQuery || filterType !== 'all' ? '沒有符合條件的角色' : '角色庫尚未建立內容'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredCharacters.map((character) => {
                const isSelected = selectedCharacters.has(character.id);
                const selectedAngle = selectedCharacters.get(character.id) || 'front';
                const previewView = character.views.find((view) => view.angle === selectedAngle) || character.views[0];

                return (
                  <div
                    key={character.id}
                    className={`surface-soft cursor-pointer overflow-hidden border transition-all ${
                      isSelected
                        ? 'border-primary/40 ring-1 ring-primary/20'
                        : 'border-border/70 hover:-translate-y-0.5 hover:border-primary/25'
                    }`}
                    onClick={() => handleToggleCharacter(character)}
                  >
                    <div className="flex gap-4 p-4">
                      {previewView && (
                        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900">
                          <img
                            src={resolveCharacterViewPreviewUrl(previewView)}
                            alt={character.name}
                            className="h-full w-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-primary/22">
                              <div className="rounded-full bg-primary p-1">
                                <Check className="h-4 w-4 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{character.name}</h3>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-medium ${TYPE_COLORS[character.type]}`}>
                            {TYPE_LABELS[character.type]}
                          </span>
                        </div>

                        <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                          {character.description}
                        </p>

                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{character.views.length} 視角</span>
                          <span>•</span>
                          <span>{character.tags.length} 標籤</span>
                        </div>

                        {isSelected && character.views.length > 1 && !includeAllViews && (
                          <div className="mt-3 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                            {character.views.map((view) => (
                              <button
                                key={view.angle}
                                onClick={() => handleChangeAngle(character.id, view.angle)}
                                className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                                  selectedAngle === view.angle
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {ANGLE_LABELS[view.angle]}
                              </button>
                            ))}
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            已準備加入 {estimatedReferenceCount} 張參考圖
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={selectedCharacters.size === 0}>
              確認加入 ({selectedCharacters.size})
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
