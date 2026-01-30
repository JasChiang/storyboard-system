'use client';

import { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { characterLibraryStorage } from '@/lib/db/character-library-storage';
import { characterLibraryItemToProjectReference } from '@/lib/types/character-library';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import type { ProjectReference } from '@/lib/types/storyboard';

interface CharacterSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (references: ProjectReference[]) => void;
  selectedIds?: string[];
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
  const [selectedCharacters, setSelectedCharacters] = useState<Map<string, 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other'>>(new Map());

  useEffect(() => {
    if (isOpen) {
      setCharacters(characterLibraryStorage.getAll());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredCharacters = characters.filter(char => {
    const matchesSearch = searchQuery === '' ||
      char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      char.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === 'all' || char.type === filterType;

    return matchesSearch && matchesType;
  });

  const handleToggleCharacter = (character: CharacterLibraryItem) => {
    const newSelected = new Map(selectedCharacters);
    if (newSelected.has(character.id)) {
      newSelected.delete(character.id);
    } else {
      // 默认选择正面视角
      newSelected.set(character.id, 'front');
    }
    setSelectedCharacters(newSelected);
  };

  const handleChangeAngle = (characterId: string, angle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other') => {
    const newSelected = new Map(selectedCharacters);
    newSelected.set(characterId, angle);
    setSelectedCharacters(newSelected);
  };

  const handleConfirm = () => {
    const references: ProjectReference[] = [];

    selectedCharacters.forEach((angle, characterId) => {
      const character = characters.find(c => c.id === characterId);
      if (character) {
        try {
          const ref = characterLibraryItemToProjectReference(character, angle);
          references.push(ref);

          // 增加使用次数
          characterLibraryStorage.incrementUsage(characterId);
        } catch (error) {
          console.error(`转换角色 ${character.name} 失败:`, error);
        }
      }
    });

    onSelect(references);
    setSelectedCharacters(new Map());
    setSearchQuery('');
    onClose();
  };

  const typeColors = {
    character: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    product: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    environment: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    style: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-2xl font-bold">从角色库选择</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              已选择 {selectedCharacters.size} 个角色
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 搜索和筛选 */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="搜索角色名称或标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600
                       rounded-lg bg-white dark:bg-slate-900
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            {['all', 'character', 'product', 'environment', 'style'].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type as typeof filterType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === type
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {type === 'all' ? '全部' :
                 type === 'character' ? '角色' :
                 type === 'product' ? '商品' :
                 type === 'environment' ? '环境' : '风格'}
              </button>
            ))}
          </div>
        </div>

        {/* 角色列表（可滚动） */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredCharacters.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                {searchQuery || filterType !== 'all' ? '没有找到匹配的角色' : '角色库为空'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCharacters.map(character => {
                const isSelected = selectedCharacters.has(character.id);
                const selectedAngle = selectedCharacters.get(character.id) || 'front';
                const previewView = character.views.find(v => v.angle === selectedAngle) || character.views[0];

                return (
                  <div
                    key={character.id}
                    className={`border-2 rounded-xl overflow-hidden transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                    onClick={() => handleToggleCharacter(character)}
                  >
                    <div className="flex gap-4 p-4">
                      {/* 缩略图 */}
                      {previewView && (
                        <div className="relative w-24 h-24 flex-shrink-0 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
                          <img
                            src={previewView.url}
                            alt={character.name}
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                              <div className="p-1 bg-blue-500 rounded-full">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-lg">{character.name}</h3>
                          <span className={`text-xs px-2 py-1 rounded ${typeColors[character.type]}`}>
                            {character.type === 'character' ? '角色' :
                             character.type === 'product' ? '商品' :
                             character.type === 'environment' ? '环境' : '风格'}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                          {character.description}
                        </p>

                        {/* 视角选择 */}
                        {isSelected && character.views.length > 1 && (
                          <div className="mt-3 flex gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                            {character.views.map(view => (
                              <button
                                key={view.angle}
                                onClick={() => handleChangeAngle(character.id, view.angle)}
                                className={`px-2 py-1 text-xs rounded transition-colors ${
                                  selectedAngle === view.angle
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                                }`}
                              >
                                {view.angle === 'front' ? '正面' :
                                 view.angle === 'side' ? '侧面' :
                                 view.angle === 'three_quarter' ? '3/4侧' :
                                 view.angle === 'back' ? '背面' :
                                 view.angle === 'top' ? '顶部' : '其他'}
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

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedCharacters.size === 0}
          >
            确认选择 ({selectedCharacters.size})
          </Button>
        </div>
      </div>
    </div>
  );
}
