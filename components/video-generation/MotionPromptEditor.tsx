'use client';

import { useState } from 'react';
import { Sparkles, Lightbulb } from 'lucide-react';

interface MotionPromptEditorProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    sceneDescription?: string;
}

export function MotionPromptEditor({
    value,
    onChange,
    disabled,
    sceneDescription,
}: MotionPromptEditorProps) {
    const [showSuggestions, setShowSuggestions] = useState(false);

    // 動作提示詞建議
    const suggestions = [
        {
            category: '鏡頭運動',
            prompts: [
                'Camera slowly zooms in',
                'Camera pans from left to right',
                'Camera rotates around the subject',
                'Smooth dolly forward',
                'Crane shot moving up',
            ],
        },
        {
            category: '人物動作',
            prompts: [
                'Person walks towards camera',
                'Character turns around slowly',
                'Gentle head movement',
                'Hand gestures while speaking',
                'Running in slow motion',
            ],
        },
        {
            category: '環境變化',
            prompts: [
                'Leaves gently swaying in breeze',
                'Clouds moving across sky',
                'Water rippling softly',
                'Light changing gradually',
                'Smoke slowly rising',
            ],
        },
        {
            category: '情緒表現',
            prompts: [
                'Subtle facial expressions',
                'Eyes looking around carefully',
                'Breathing motion',
                'Hair flowing in wind',
                'Gentle smile forming',
            ],
        },
    ];

    const handleSuggestionClick = (prompt: string) => {
        if (value) {
            onChange(`${value}, ${prompt}`);
        } else {
            onChange(prompt);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    動作提示詞 (Motion Prompt)
                </label>
                <button
                    type="button"
                    onClick={() => setShowSuggestions(!showSuggestions)}
                    className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors
                   flex items-center gap-1"
                >
                    <Lightbulb className="w-3 h-3" />
                    {showSuggestions ? '隱藏建議' : '查看建議'}
                </button>
            </div>

            {sceneDescription && (
                <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 mb-1">場景描述</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{sceneDescription}</p>
                </div>
            )}

            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="描述畫面中的動作、鏡頭運動等... 例如: Camera slowly zooms in, person walks forward"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg
                 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400
                 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500
                 transition-colors resize-none"
                rows={4}
                disabled={disabled}
            />

            {showSuggestions && (
                <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Sparkles className="w-4 h-4" />
                        <span>點擊建議自動添加到提示詞</span>
                    </div>

                    <div className="space-y-4">
                        {suggestions.map((category) => (
                            <div key={category.category}>
                                <h4 className="text-xs font-medium text-slate-500 mb-2">
                                    {category.category}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {category.prompts.map((prompt) => (
                                        <button
                                            key={prompt}
                                            type="button"
                                            onClick={() => handleSuggestionClick(prompt)}
                                            disabled={disabled}
                                            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700
                               border border-slate-200 dark:border-slate-700
                               text-xs text-slate-600 dark:text-slate-300 rounded-lg
                               transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p className="text-xs text-slate-500">
                💡 提示：清晰描述動作可以提升影片生成品質
            </p>
        </div>
    );
}
