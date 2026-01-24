'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/lib/prompts';
import { Loader2 } from 'lucide-react';
import { ProjectReferenceUploader } from './ProjectReferenceUploader';
import type { ProjectReference } from '@/lib/types/storyboard';

interface StoryPromptInputProps {
  onGenerate: (prompt: string, templateId: string, references: ProjectReference[]) => Promise<void>;
  isLoading: boolean;
}

export function StoryPromptInput({ onGenerate, isLoading }: StoryPromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [references, setReferences] = useState<ProjectReference[]>([]);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    await onGenerate(prompt, templateId, references);
  };

  const templateOptions = TEMPLATES.map(t => ({
    value: t.id,
    label: t.name
  }));

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

        {selectedTemplate && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {selectedTemplate.description}
            </p>
          </div>
        )}

        {/* 參考圖上傳區 */}
        <ProjectReferenceUploader
          references={references}
          onChange={setReferences}
          disabled={isLoading}
        />

        {/* 參考圖提示 */}
        {references.length > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✅ 已設定 {references.length} 張參考圖。AI 生成的分鏡描述會使用 &lt;角色名&gt; 或 &lt;商品名&gt; 格式標記，不會重複描述外觀。
            </p>
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
    </div>
  );
}
