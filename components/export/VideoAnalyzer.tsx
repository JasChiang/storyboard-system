'use client';

import { useState } from 'react';
import { Brain, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Scene } from '@/lib/types/storyboard';
import type { Storyboard } from '@/lib/types/storyboard';
import type { EditingSuggestion } from '@/lib/types/project';

interface VideoAnalyzerProps {
    storyboard: Storyboard;
    onAnalysisComplete: (suggestion: EditingSuggestion) => void;
}

export function VideoAnalyzer({ storyboard, onAnalysisComplete }: VideoAnalyzerProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<EditingSuggestion | null>(null);
    const [error, setError] = useState<string | null>(null);

    const scenesWithVideos = storyboard.scenes.filter(s => s.generatedVideo);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        setError(null);

        try {
            const apiKey = localStorage.getItem('gemini_api_key');
            if (!apiKey) {
                alert('請先在設定中輸入 Gemini API Key');
                return;
            }

            // 注意：此功能需要將影片上傳到 Gemini
            // 由於影片已經是 URL，我們直接使用 URL 進行分析
            // 實際應用中可能需要先下載影片再上傳

            const response = await fetch('/api/gemini/analyze-videos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyboard,
                    uploadedFiles: scenesWithVideos.map(scene => ({
                        name: `scene_${scene.sceneNumber}.mp4`,
                        uri: scene.generatedVideo!.url,
                        mimeType: 'video/mp4',
                        state: 'ACTIVE',
                    })),
                    apiKey,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Analysis failed');
            }

            setResult(data.suggestion);
            onAnalysisComplete(data.suggestion);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '分析失敗';
            setError(errorMsg);
            console.error('Analysis error:', error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (scenesWithVideos.length === 0) {
        return (
            <div className="p-6 bg-amber-900/20 border border-amber-500/30 rounded-lg text-center">
                <p className="text-amber-400 text-sm">
                    ⚠️ 尚未生成任何影片，無法進行分析
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* 分析說明 */}
            <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
                <div className="flex items-start gap-3">
                    <Brain className="w-5 h-5 text-purple-400 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-sm font-medium text-zinc-200 mb-1">
                            AI 影片分析
                        </h3>
                        <p className="text-xs text-zinc-500">
                            使用 Gemini 2.0 Flash 分析影片內容，自動生成剪輯建議
                        </p>
                    </div>
                </div>

                <div className="mt-3 text-xs text-zinc-600">
                    <p>✓ 將分析 {scenesWithVideos.length} 個場景影片</p>
                    <p>✓ 提供入點/出點、轉場效果、視覺效果建議</p>
                </div>
            </div>

            {/* 分析按鈕 */}
            {!result && (
                <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 
                   hover:from-blue-700 hover:to-purple-700
                   text-white font-medium rounded-lg
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-all flex items-center justify-center gap-2"
                >
                    {isAnalyzing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            分析中...
                        </>
                    ) : (
                        <>
                            <Brain className="w-5 h-5" />
                            開始分析影片
                        </>
                    )}
                </button>
            )}

            {/* 錯誤訊息 */}
            {error && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-red-400">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">{error}</span>
                    </div>
                </div>
            )}

            {/* 分析結果 */}
            {result && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        分析完成
                    </div>

                    <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 space-y-3">
                        <div>
                            <h4 className="text-sm font-medium text-zinc-300 mb-2">整體建議</h4>
                            <p className="text-xs text-zinc-400">{result.summary}</p>
                        </div>

                        {result.audioNotes && (
                            <div>
                                <h4 className="text-sm font-medium text-zinc-300 mb-2">音頻處理</h4>
                                <p className="text-xs text-zinc-400">{result.audioNotes}</p>
                            </div>
                        )}

                        {result.scenes && result.scenes.length > 0 && (
                            <div>
                                <h4 className="text-sm font-medium text-zinc-300 mb-2">
                                    場景剪輯建議 ({result.scenes.length})
                                </h4>
                                <div className="space-y-2">
                                    {result.scenes.slice(0, 3).map((scene, idx) => (
                                        <div key={idx} className="p-2 bg-zinc-900 rounded text-xs">
                                            <p className="text-zinc-300">
                                                場景: {scene.sceneId}
                                            </p>
                                            <p className="text-zinc-500">
                                                入點: {scene.inPoint}s | 出點: {scene.outPoint}s
                                            </p>
                                            {scene.transition && (
                                                <p className="text-zinc-500">轉場: {scene.transition}</p>
                                            )}
                                        </div>
                                    ))}
                                    {result.scenes.length > 3 && (
                                        <p className="text-xs text-zinc-600">
                                            還有 {result.scenes.length - 3} 個場景建議...
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
