'use client';

import { useState, useEffect } from 'react';
import { characterLibraryStorage } from '@/lib/db/character-library-storage';
import type { CharacterLibraryItem } from '@/lib/types/character-library';
import { Button } from '@/components/ui/button';
import { Plus, Search, Trash2, Edit, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { CharacterCreateDialog } from '@/components/character-library/CharacterCreateDialog';

export default function CharacterLibraryPage() {
  const [characters, setCharacters] = useState<CharacterLibraryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | CharacterLibraryItem['type']>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<CharacterLibraryItem | undefined>();

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = () => {
    setCharacters(characterLibraryStorage.getAll());
  };

  const filteredCharacters = characters.filter(char => {
    const matchesSearch = searchQuery === '' ||
      char.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      char.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === 'all' || char.type === filterType;

    return matchesSearch && matchesType;
  });

  const handleDelete = (id: string) => {
    if (confirm('确定要删除此角色？此操作无法撤销。')) {
      characterLibraryStorage.delete(id);
      loadCharacters();
    }
  };

  const handleSave = (character: Omit<CharacterLibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    if (editingCharacter) {
      characterLibraryStorage.update(editingCharacter.id, character);
    } else {
      characterLibraryStorage.add(character);
    }
    loadCharacters();
    setShowCreateDialog(false);
    setEditingCharacter(undefined);
  };

  const handleEdit = (character: CharacterLibraryItem) => {
    setEditingCharacter(character);
    setShowCreateDialog(true);
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingCharacter(undefined);
  };

  const typeOptions = [
    { value: 'all', label: '全部', count: characters.length },
    { value: 'character', label: '角色', count: characters.filter(c => c.type === 'character').length },
    { value: 'product', label: '商品', count: characters.filter(c => c.type === 'product').length },
    { value: 'environment', label: '环境', count: characters.filter(c => c.type === 'environment').length },
    { value: 'style', label: '风格', count: characters.filter(c => c.type === 'style').length },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-white/50 backdrop-blur-xl dark:bg-black/50 supports-[backdrop-filter]:bg-white/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">角色库</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                管理可复用的 IP 角色、商品与风格参考
              </p>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">
                返回首页
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* 工具栏 */}
          <div className="mb-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索角色名称或标签..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600
                           rounded-lg bg-white dark:bg-slate-800
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                新增角色
              </Button>
            </div>

            {/* 类型筛选 */}
            <div className="flex gap-2">
              {typeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFilterType(opt.value as typeof filterType)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-colors
                    ${filterType === opt.value
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }
                  `}
                >
                  {opt.label} {opt.count > 0 && `(${opt.count})`}
                </button>
              ))}
            </div>
          </div>

          {/* 角色列表 */}
          {filteredCharacters.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {searchQuery || filterType !== 'all' ? '没有找到匹配的角色' : '角色库为空'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {searchQuery || filterType !== 'all'
                  ? '尝试调整搜索条件或筛选器'
                  : '点击「新增角色」按钮开始添加可复用的 IP 角色'
                }
              </p>
              {!searchQuery && filterType === 'all' && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增第一个角色
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCharacters.map(character => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onDelete={handleDelete}
                  onEdit={() => handleEdit(character)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 创建/编辑角色对话框 */}
      <CharacterCreateDialog
        isOpen={showCreateDialog}
        onClose={handleCloseDialog}
        onSave={handleSave}
        editingCharacter={editingCharacter}
      />
    </>
  );
}

function CharacterCard({
  character,
  onDelete,
  onEdit
}: {
  character: CharacterLibraryItem;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}) {
  const frontView = character.views.find(v => v.angle === 'front') || character.views[0];

  const typeColors = {
    character: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    product: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    environment: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    style: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:shadow-lg transition-shadow">
      {/* 主图 */}
      {frontView && (
        <div className="relative aspect-video bg-slate-100 dark:bg-slate-900">
          <img
            src={frontView.url}
            alt={character.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <button
              onClick={() => onEdit(character.id)}
              className="p-1.5 bg-white/90 hover:bg-white rounded-lg transition-colors"
            >
              <Edit className="w-4 h-4 text-slate-700" />
            </button>
            <button
              onClick={() => onDelete(character.id)}
              className="p-1.5 bg-white/90 hover:bg-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      )}

      {/* 信息 */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-lg">{character.name}</h3>
          <span className={`text-xs px-2 py-1 rounded ${typeColors[character.type]}`}>
            {character.type === 'character' ? '角色' :
             character.type === 'product' ? '商品' :
             character.type === 'environment' ? '环境' : '风格'}
          </span>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
          {character.description}
        </p>

        {/* 标签 */}
        {character.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {character.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700
                         text-slate-600 dark:text-slate-300 rounded"
              >
                {tag}
              </span>
            ))}
            {character.tags.length > 3 && (
              <span className="text-xs text-slate-500">
                +{character.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 统计 */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>{character.views.length} 个视角</span>
          <span>使用 {character.usageCount} 次</span>
        </div>
      </div>
    </div>
  );
}
