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
            name: 'Kling',
            description: '電影感運鏡、起尾幀轉場、O1 多參考一致性',
            icon: Film,
            features: ['2.6 Pro / O3 / O1', '起尾幀或多參考', '5 或 10 秒'],
        },
        {
            id: 'seedance' as const,
            name: 'Seedance',
            description: 'ByteDance 家族，2.0 reference-to-video 最多 9 張參考',
            icon: Wand2,
            features: ['1.5 / 2.0 / 2.0 Ref', '4-12 秒', '480p / 720p / 1080p'],
        },
    ];

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                選擇影片生成模型家族
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
                relative p-4 rounded-lg border-2 transition-all text-left shadow-sm
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isSelected
                                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                                }
              `}
                        >
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-2 h-2 bg-blue-600 dark:bg-blue-500 rounded-full" />
                            )}

                            <div className="flex items-start gap-3 mb-3">
                                <div className={`
                  p-2 rounded-lg
                  ${isSelected ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-700'}
                `}>
                                    <Icon className={`
                    w-5 h-5
                    ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}
                  `} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-sm font-semibold mb-1 ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-slate-900 dark:text-white'}`}>
                                        {model.name}
                                    </h3>
                                    <p className={`text-xs ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>
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
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
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
