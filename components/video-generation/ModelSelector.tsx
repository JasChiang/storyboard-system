'use client';

import { Film, Wand2 } from 'lucide-react';

type VideoModel = 'kling' | 'seedance';

interface ModelSelectorProps {
    value: VideoModel;
    onChange: (model: VideoModel) => void;
    disabled?: boolean;
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
    const models = [
        {
            id: 'kling' as const,
            name: 'Kling 2.6 Pro',
            description: '高品質影片生成，支援 5-10 秒',
            icon: Film,
            features: ['5 或 10 秒', '16:9 / 9:16 / 1:1', '可選音效'],
        },
        {
            id: 'seedance' as const,
            name: 'Seedance 1.5 Pro',
            description: 'ByteDance 影片生成，支援 4-12 秒',
            icon: Wand2,
            features: ['4-12 秒', '可選音頻', '快速生成'],
        },
    ];

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-300">
                選擇影片生成模型
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {models.map((model) => {
                    const Icon = model.icon;
                    const isSelected = value === model.id;

                    return (
                        <button
                            key={model.id}
                            onClick={() => onChange(model.id)}
                            disabled={disabled}
                            className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isSelected
                                    ? 'border-purple-500 bg-purple-900/20'
                                    : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
                                }
              `}
                        >
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full" />
                            )}

                            <div className="flex items-start gap-3 mb-3">
                                <div className={`
                  p-2 rounded-lg
                  ${isSelected ? 'bg-purple-600/20' : 'bg-zinc-800'}
                `}>
                                    <Icon className={`
                    w-5 h-5
                    ${isSelected ? 'text-purple-400' : 'text-zinc-500'}
                  `} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-white mb-1">
                                        {model.name}
                                    </h3>
                                    <p className="text-xs text-zinc-500">
                                        {model.description}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {model.features.map((feature, idx) => (
                                    <span
                                        key={idx}
                                        className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${isSelected
                                                ? 'bg-purple-500/20 text-purple-300'
                                                : 'bg-zinc-800 text-zinc-400'
                                            }
                    `}
                                    >
                                        {feature}
                                    </span>
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
