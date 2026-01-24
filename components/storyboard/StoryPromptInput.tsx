'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TEMPLATES } from '@/lib/prompts';
import { Loader2 } from 'lucide-react';

interface StoryPromptInputProps {
  onGenerate: (prompt: string, templateId: string) => Promise<void>;
  isLoading: boolean;
}

export function StoryPromptInput({ onGenerate, isLoading }: StoryPromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    await onGenerate(prompt, templateId);
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
