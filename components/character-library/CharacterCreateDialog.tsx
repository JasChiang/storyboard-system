'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fal } from '@fal-ai/client';
import type { CharacterLibraryItem } from '@/lib/types/character-library';

interface CharacterCreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (character: Omit<CharacterLibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => void;
  editingCharacter?: CharacterLibraryItem;
}

interface ViewUpload {
  angle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';
  url: string;
  description: string;
  mustKeepFeatures?: string[];
  identityCore?: string;
  styleTraits?: string;
  angleVisibility?: string;
}

const ANGLE_OPTIONS = [
  { value: 'front' as const, label: '正面', emoji: '⬛' },
  { value: 'side' as const, label: '側面', emoji: '◼️' },
  { value: 'three_quarter' as const, label: '3/4 側', emoji: '📐' },
  { value: 'back' as const, label: '背面', emoji: '⬜' },
  { value: 'top' as const, label: '頂部', emoji: '🔼' },
  { value: 'other' as const, label: '其他', emoji: '⚪' },
];

const TYPE_OPTIONS = [
  { value: 'character' as const, label: '角色', hint: '人物、動物角色' },
  { value: 'product' as const, label: '商品', hint: '產品、道具' },
  { value: 'environment' as const, label: '環境', hint: '場景、背景' },
  { value: 'style' as const, label: '風格', hint: '視覺風格參考' },
];

export function CharacterCreateDialog({
  isOpen,
  onClose,
  onSave,
  editingCharacter,
}: CharacterCreateDialogProps) {
  const [name, setName] = useState(editingCharacter?.name || '');
  const [type, setType] = useState<CharacterLibraryItem['type']>(editingCharacter?.type || 'character');
  const [description, setDescription] = useState(editingCharacter?.description || '');
  const [guidelines, setGuidelines] = useState(editingCharacter?.guidelines || '');
  const [tags, setTags] = useState<string[]>(editingCharacter?.tags || []);
  const [views, setViews] = useState<ViewUpload[]>(editingCharacter?.views || []);
  const [currentTag, setCurrentTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingAngle, setUploadingAngle] = useState<ViewUpload['angle'] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingGuidelines, setIsGeneratingGuidelines] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (editingCharacter) {
      setName(editingCharacter.name || '');
      setType(editingCharacter.type || 'character');
      setDescription(editingCharacter.description || '');
      setGuidelines(editingCharacter.guidelines || '');
      setTags(editingCharacter.tags || []);
      setViews(editingCharacter.views || []);
    } else {
      setName('');
      setType('character');
      setDescription('');
      setGuidelines('');
      setTags([]);
      setViews([]);
    }
  }, [isOpen, editingCharacter]);

  if (!isOpen) return null;

  const handleFileSelect = async (angle: ViewUpload['angle'], file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請上傳圖片文件');
      return;
    }

    setIsUploading(true);
    setUploadingAngle(angle);

    try {
      const uploadedUrl = await fal.storage.upload(file);

      // 使用 AI 分析圖片
      setIsAnalyzing(true);
      const imageBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/openrouter/analyze-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          angle,
          type,
          userNote: `${name} - ${angle}`,
        }),
      });

      const data = await response.json();
      const aiDescription = response.ok ? data.description : `${name} 的 ${ANGLE_OPTIONS.find(a => a.value === angle)?.label}`;

      setViews([...views, {
        angle,
        url: uploadedUrl,
        description: aiDescription,
        mustKeepFeatures: data.analysis?.mustKeep || [],
        identityCore: data.analysis?.identityCore,
        styleTraits: data.analysis?.styleTraits,
        angleVisibility: data.analysis?.angleVisibility,
      }]);
    } catch (error) {
      console.error('上傳錯誤:', error);
      alert(error instanceof Error ? error.message : '上傳失敗');
    } finally {
      setIsUploading(false);
      setUploadingAngle(null);
      setIsAnalyzing(false);
    }
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags([...tags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleRemoveView = (angle: ViewUpload['angle']) => {
    setViews(views.filter(v => v.angle !== angle));
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert('請輸入名稱');
      return;
    }

    if (views.length === 0) {
      alert('至少上傳一個視角的圖片');
      return;
    }

    onSave({
      name: name.trim(),
      type,
      description: description.trim() || `${name} - ${TYPE_OPTIONS.find(t => t.value === type)?.label}`,
      guidelines: guidelines.trim() || undefined,
      tags,
      views,
    });

    // 重置表單
    setName('');
    setType('character');
    setDescription('');
    setGuidelines('');
    setTags([]);
    setViews([]);
    onClose();
  };

  const generateProfileField = async (target: 'description' | 'guidelines') => {
    if (!name.trim()) {
      alert('請先輸入名稱');
      return;
    }

    if (views.length === 0) {
      alert('請先上傳至少一張視角圖片');
      return;
    }

    if (target === 'description') {
      setIsGeneratingDescription(true);
    } else {
      setIsGeneratingGuidelines(true);
    }

    try {
      const response = await fetch('/api/openrouter/generate-character-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          views,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '生成失敗');
      }

      if (target === 'description') {
        setDescription(data.description || '');
      } else {
        setGuidelines(data.guidelines || '');
      }
    } catch (error) {
      console.error('Generate profile field error:', error);
      alert(error instanceof Error ? error.message : '生成失敗');
    } finally {
      if (target === 'description') {
        setIsGeneratingDescription(false);
      } else {
        setIsGeneratingGuidelines(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-2xl font-bold">
            {editingCharacter ? '編輯角色' : '新增角色'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 內容區（可捲動） */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 基本資訊 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">名稱 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：小熊吉祥物、iPhone 15"
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">類型 *</label>
              <div className="grid grid-cols-4 gap-3">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      type === opt.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {opt.hint}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium">描述</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateProfileField('description')}
                  disabled={isGeneratingDescription || isUploading || isAnalyzing}
                >
                  {isGeneratingDescription ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      生成中
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI 生成描述
                    </>
                  )}
                </Button>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="角色的整體描述、特徵、用途等..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-none"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium">角色規則 / 限制</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => generateProfileField('guidelines')}
                  disabled={isGeneratingGuidelines || isUploading || isAnalyzing}
                >
                  {isGeneratingGuidelines ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      生成中
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI 生成規則
                    </>
                  )}
                </Button>
              </div>
              <textarea
                value={guidelines}
                onChange={(e) => setGuidelines(e.target.value)}
                placeholder="例如：不可穿鞋、永遠微笑、手上必須拿藍色杯子..."
                rows={2}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500
                         resize-none"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                會加入到生成提示詞中，確保角色遵守設定
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">標籤</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="輸入標籤後按 Enter"
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                           bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button onClick={handleAddTag} disabled={!currentTag.trim()}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 dark:bg-slate-700
                               text-sm rounded-lg"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 視角圖片上傳 */}
          <div>
            <label className="block text-sm font-medium mb-3">視角圖片 *</label>
            <div className="grid grid-cols-3 gap-4">
              {ANGLE_OPTIONS.map(angle => {
                const existingView = views.find(v => v.angle === angle.value);

                return (
                  <div key={angle.value} className="space-y-2">
                    <div
                      className="relative aspect-square border-2 border-dashed border-slate-300 dark:border-slate-600
                               rounded-lg overflow-hidden group hover:border-blue-400 transition-colors"
                    >
                      {existingView ? (
                        <>
                          <img
                            src={existingView.url}
                            alt={angle.label}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100
                                        transition-opacity flex items-center justify-center">
                            <button
                              onClick={() => handleRemoveView(angle.value)}
                              className="p-2 bg-red-500 hover:bg-red-600 rounded-lg"
                            >
                              <X className="w-5 h-5 text-white" />
                            </button>
                          </div>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-white text-xs">
                            {angle.emoji} {angle.label}
                          </div>
                        </>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-full cursor-pointer">
                          {isUploading && uploadingAngle === angle.value ? (
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                          ) : (
                            <>
                              <span className="text-3xl mb-2">{angle.emoji}</span>
                              <span className="text-sm font-medium">{angle.label}</span>
                              <span className="text-xs text-slate-500 mt-1">點擊上傳</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileSelect(angle.value, file);
                            }}
                            disabled={isUploading}
                          />
                        </label>
                      )}
                    </div>

                    {existingView?.description && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3">
                        {existingView.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {isAnalyzing && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <Sparkles className="w-4 h-4 animate-pulse" />
                AI 正在分析圖片...
              </div>
            )}
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || views.length === 0 || isUploading || isGeneratingDescription || isGeneratingGuidelines}
          >
            {editingCharacter ? '保存修改' : '建立角色'}
          </Button>
        </div>
      </div>
    </div>
  );
}
