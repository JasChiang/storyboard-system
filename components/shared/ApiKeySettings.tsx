'use client';

import { useState, useEffect } from 'react';
import { Settings, Key, Save, Eye, EyeOff } from 'lucide-react';

export function ApiKeySettings() {
    const [isOpen, setIsOpen] = useState(false);
    const [showKeys, setShowKeys] = useState(false);

    const [openrouterKey, setOpenrouterKey] = useState('');
    const [falKey, setFalKey] = useState('');
    const [geminiKey, setGeminiKey] = useState('');

    const [saved, setSaved] = useState(false);

    useEffect(() => {
        // 載入已儲存的 API Keys
        setOpenrouterKey(localStorage.getItem('openrouter_api_key') || '');
        setFalKey(localStorage.getItem('fal_api_key') || '');
        setGeminiKey(localStorage.getItem('gemini_api_key') || '');
    }, []);

    const handleSave = () => {
        localStorage.setItem('openrouter_api_key', openrouterKey);
        localStorage.setItem('fal_api_key', falKey);
        localStorage.setItem('gemini_api_key', geminiKey);

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const maskKey = (key: string) => {
        if (!key || showKeys) return key;
        if (key.length < 8) return '••••••';
        return key.slice(0, 4) + '••••••' + key.slice(-4);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 p-4 bg-purple-600 hover:bg-purple-700
                 text-white rounded-full shadow-lg transition-all z-50
                 flex items-center gap-2 group"
            >
                <Settings className="w-5 h-5" />
                <span className="max-w-0 group-hover:max-w-xs overflow-hidden transition-all duration-300
                       whitespace-nowrap text-sm">
                    API 設定
                </span>
            </button>
        );
    }

    return (
        <>
            {/* 遮罩 */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => setIsOpen(false)}
            />

            {/* 設定面板 */}
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-zinc-900 z-50
                    shadow-2xl overflow-y-auto">
                <div className="p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Key className="w-6 h-6 text-purple-400" />
                            <h2 className="text-xl font-bold text-white">API 金鑰設定</h2>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400"
                        >
                            ✕
                        </button>
                    </div>

                    {/* 說明 */}
                    <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                        <p className="text-sm text-blue-200">
                            API 金鑰將儲存在瀏覽器的 LocalStorage 中，不會傳送到伺服器
                        </p>
                    </div>

                    {/* 顯示/隱藏切換 */}
                    <button
                        onClick={() => setShowKeys(!showKeys)}
                        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-300"
                    >
                        {showKeys ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {showKeys ? '隱藏金鑰' : '顯示金鑰'}
                    </button>

                    {/* OpenRouter API Key */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-300">
                            OpenRouter API Key
                        </label>
                        <p className="text-xs text-zinc-500 mb-2">
                            用於分鏡腳本生成 (Claude 3.5 Sonnet / GPT-4o)
                        </p>
                        <input
                            type={showKeys ? "text" : "password"}
                            value={openrouterKey}
                            onChange={(e) => setOpenrouterKey(e.target.value)}
                            placeholder="sk-or-..."
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg
                       text-sm text-zinc-200 placeholder-zinc-600
                       focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                        <a
                            href="https://openrouter.ai/settings/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-400 hover:text-purple-300"
                        >
                            獲取 API Key →
                        </a>
                    </div>

                    {/* Fal AI API Key */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-300">
                            Fal AI API Key
                        </label>
                        <p className="text-xs text-zinc-500 mb-2">
                            用於圖片和影片生成 (Nano Banana Pro / Kling / Seedance)
                        </p>
                        <input
                            type={showKeys ? "text" : "password"}
                            value={falKey}
                            onChange={(e) => setFalKey(e.target.value)}
                            placeholder="..."
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg
                       text-sm text-zinc-200 placeholder-zinc-600
                       focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                        <a
                            href="https://fal.ai/dashboard/keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-400 hover:text-purple-300"
                        >
                            獲取 API Key →
                        </a>
                    </div>

                    {/* Gemini API Key */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-300">
                            Gemini API Key
                        </label>
                        <p className="text-xs text-zinc-500 mb-2">
                            用於影片分析 (Gemini 2.0 Flash)
                        </p>
                        <input
                            type={showKeys ? "text" : "password"}
                            value={geminiKey}
                            onChange={(e) => setGeminiKey(e.target.value)}
                            placeholder="AIza..."
                            className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg
                       text-sm text-zinc-200 placeholder-zinc-600
                       focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        />
                        <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-purple-400 hover:text-purple-300"
                        >
                            獲取 API Key →
                        </a>
                    </div>

                    {/* 儲存按鈕 */}
                    <button
                        onClick={handleSave}
                        className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700
                     text-white font-medium rounded-lg transition-colors
                     flex items-center justify-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        {saved ? '已儲存 ✓' : '儲存設定'}
                    </button>

                    {/* 使用說明 */}
                    <div className="p-4 bg-zinc-950 rounded-lg border border-zinc-800">
                        <h3 className="text-sm font-medium text-zinc-300 mb-2">使用說明</h3>
                        <ol className="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
                            <li>點擊上方連結獲取對應的 API Key</li>
                            <li>將 API Key 貼入對應欄位</li>
                            <li>點擊「儲存設定」即可開始使用</li>
                            <li>API Key 僅儲存在本地，不會上傳</li>
                        </ol>
                    </div>
                </div>
            </div>
        </>
    );
}
