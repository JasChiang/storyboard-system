'use client';

import { useState } from 'react';
import { Download, FileCode2, Check } from 'lucide-react';
import { generateBlenderScript, downloadBlenderScript } from '@/lib/blender/script-generator';
import type { Scene } from '@/lib/types/storyboard';
import type { EditingSuggestion } from '@/lib/types/project';

interface BlenderScriptViewerProps {
    projectName: string;
    scenes: Scene[];
    editingSuggestion?: EditingSuggestion;
}

export function BlenderScriptViewer({
    projectName,
    scenes,
    editingSuggestion,
}: BlenderScriptViewerProps) {
    const [script, setScript] = useState<string>('');
    const [isGenerated, setIsGenerated] = useState(false);

    const handleGenerate = () => {
        const generatedScript = generateBlenderScript({
            projectName,
            scenes,
            editingSuggestion,
            fps: 30,
            resolution: { width: 1920, height: 1080 },
        });

        setScript(generatedScript);
        setIsGenerated(true);
    };

    const handleDownload = () => {
        const filename = `${projectName.replace(/\s+/g, '_')}_blender_script.py`;
        downloadBlenderScript(script, filename);
    };

    const scenesWithVideos = scenes.filter(s => s.generatedVideo);

    if (scenesWithVideos.length === 0) {
        return (
            <div className="p-6 bg-amber-900/20 border border-amber-500/30 rounded-lg text-center">
                <p className="text-amber-400 text-sm">
                    ⚠️ 尚未生成任何影片，無法生成 Blender 腳本
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 資訊卡片 */}
            <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="flex items-start gap-3">
                    <FileCode2 className="w-5 h-5 text-purple-400 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-zinc-200 mb-1">
                            Blender Python 腳本
                        </h3>
                        <p className="text-xs text-zinc-500">
                            自動生成的 Blender 剪輯腳本，包含 {scenesWithVideos.length} 個影片片段
                        </p>
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div className="p-2 bg-zinc-900 rounded">
                        <span className="text-zinc-500">影片片段</span>
                        <p className="text-zinc-200 font-medium">{scenesWithVideos.length}</p>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded">
                        <span className="text-zinc-500">解析度</span>
                        <p className="text-zinc-200 font-medium">1920x1080</p>
                    </div>
                    <div className="p-2 bg-zinc-900 rounded">
                        <span className="text-zinc-500">幀率</span>
                        <p className="text-zinc-200 font-medium">30 FPS</p>
                    </div>
                </div>
            </div>

            {/* 腳本預覽 */}
            {isGenerated && script && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-sm font-medium text-zinc-300">腳本預覽</h4>
                        <div className="flex items-center gap-2 text-xs text-green-400">
                            <Check className="w-4 h-4" />
                            已生成
                        </div>
                    </div>

                    <div className="relative">
                        <pre className="p-4 bg-zinc-950 rounded-lg border border-zinc-800
                         text-xs text-zinc-300 overflow-x-auto max-h-96 overflow-y-auto
                         font-mono">
                            {script}
                        </pre>
                    </div>
                </div>
            )}

            {/* 操作按鈕 */}
            <div className="flex gap-3">
                {!isGenerated ? (
                    <button
                        onClick={handleGenerate}
                        className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700
                     text-white font-medium rounded-lg transition-colors
                     flex items-center justify-center gap-2"
                    >
                        <FileCode2 className="w-5 h-5" />
                        生成 Blender 腳本
                    </button>
                ) : (
                    <button
                        onClick={handleDownload}
                        className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700
                     text-white font-medium rounded-lg transition-colors
                     flex items-center justify-center gap-2"
                    >
                        <Download className="w-5 h-5" />
                        下載 .py 檔案
                    </button>
                )}
            </div>

            {/* 使用說明 */}
            <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <h4 className="text-sm font-medium text-blue-300 mb-2">使用說明</h4>
                <ol className="text-xs text-blue-200/80 space-y-1 list-decimal list-inside">
                    <li>下載生成的 Python 腳本</li>
                    <li>在 Blender 中開啟影片編輯工作區 (Video Editing)</li>
                    <li>開啟 Scripting 面板</li>
                    <li>載入並執行此腳本</li>
                    <li>腳本會自動導入所有影片片段並設定轉場效果</li>
                </ol>
            </div>
        </div>
    );
}
