'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/lib/prompts';
import { Loader2, Plus, Users } from 'lucide-react';
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
    targetDurationSec: number
  ) => Promise<void>;
  isLoading: boolean;
}

export function StoryPromptInput({ onGenerate, isLoading }: StoryPromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [targetDurationSec, setTargetDurationSec] = useState('30');
  const [references, setReferences] = useState<ProjectReference[]>([]);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [showCreateCharacterDialog, setShowCreateCharacterDialog] = useState(false);

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
    await onGenerate(prompt, templateId, references, Number(targetDurationSec));
  };

  const handleSelectFromLibrary = (newReferences: ProjectReference[]) => {
    // 合並角色庫選擇的角色和已有的暫時上傳
    setReferences((prev) => mergeUniqueReferences(prev, newReferences));
  };

  const handleCreateToLibrary = (character: Parameters<typeof characterLibraryStorage.add>[0]) => {
    const created = characterLibraryStorage.add(character);
    // 建立後先預設帶入正面視角，讓使用者可立即使用
    const reference = characterLibraryItemToProjectReference(created, 'front');
    setReferences(prev => mergeUniqueReferences(prev, [reference]));
    setShowCreateCharacterDialog(false);
  };

  const templateOptions = TEMPLATES.map(t => ({
    value: t.id,
    label: t.name
  }));
  const durationOptions = [
    { value: '15', label: '15 秒（約 3 場）' },
    { value: '20', label: '20 秒（約 4 場）' },
    { value: '25', label: '25 秒（約 5 場）' },
    { value: '30', label: '30 秒（約 6 場）' },
  ];

  const selectedTemplate = TEMPLATES.find(t => t.id === templateId);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
      <h2 className="text-2xl font-bold mb-4">故事需求輸入</h2>

      <div className="space-y-4">
        <Select
          label="分鏡模板"
          options={templateOptions}
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        />
        <Select
          label="目標影片長度"
          options={durationOptions}
          value={targetDurationSec}
          onChange={(e) => setTargetDurationSec(e.target.value)}
        />

        {selectedTemplate && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {selectedTemplate.description}
            </p>
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
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✅ 已設定 {references.length} 張參考圖。AI 生成的分鏡描述會使用 &lt;角色名&gt; 或 &lt;商品名&gt; 格式標記，不會重複描述外觀。
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {references.map(ref => (
                <span
                  key={ref.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-800
                           text-xs rounded border border-green-300 dark:border-green-700"
                >
                  {ref.name ? `<${ref.name}>` : ref.type}
                  {ref.descriptionSource === 'ai' && ' 🤖'}
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
