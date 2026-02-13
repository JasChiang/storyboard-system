'use client';

import { useState, useRef } from 'react';
import { X, Plus, Sparkles, Loader2 } from 'lucide-react';
import { fal } from '@fal-ai/client';
import type { ProjectReference } from '@/lib/types/storyboard';
import { buildStructuredIdentityLock } from '@/lib/references/identity-lock';

interface ProjectReferenceUploaderProps {
    references: ProjectReference[];
    onChange: (refs: ProjectReference[]) => void;
    disabled?: boolean;
}

const TYPE_OPTIONS = [
    { value: 'character', label: '角色', hint: '角色外觀、服裝' },
    { value: 'product', label: '商品', hint: '產品外觀、材質' },
    { value: 'environment', label: '環境', hint: '場景、背景' },
    { value: 'style', label: '風格', hint: '視覺風格參考' },
] as const;

const ANGLE_OPTIONS = [
    { value: 'front', label: '正面', emoji: '⬛' },
    { value: 'side', label: '側面', emoji: '◼️' },
    { value: 'three_quarter', label: '3/4 側', emoji: '📐' },
    { value: 'back', label: '背面', emoji: '⬜' },
    { value: 'top', label: '頂部', emoji: '🔼' },
    { value: 'other', label: '其他', emoji: '⚪' },
] as const;

export function ProjectReferenceUploader({
    references,
    onChange,
    disabled
}: ProjectReferenceUploaderProps) {
    const [isUploading, setIsUploading] = useState(false);
    const [editingRef, setEditingRef] = useState<ProjectReference | null>(null);
    const [isDescribing, setIsDescribing] = useState(false);
    const [userNote, setUserNote] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('請上傳圖片檔案');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            alert('圖片檔案過大，請上傳小於 10MB 的圖片');
            return;
        }

        setIsUploading(true);

        try {
            // 直接使用 Fal SDK 上傳
            // 如果前端有 API key，會直接上傳；否則會通過 Server Proxy
            const uploadedUrl = await fal.storage.upload(file);

            // 創建新的參考圖（待填寫描述）
            const newRef: ProjectReference = {
                id: crypto.randomUUID(),
                url: uploadedUrl,
                description: '',
                type: 'product',  // 預設商品類型
                angle: 'front',    // 🆕 預設正面
                descriptionSource: 'manual',
            };

            setEditingRef(newRef);
            setUserNote('');  // 重置使用者說明
        } catch (error) {
            console.error('Upload error:', error);
            alert(error instanceof Error ? error.message : '上傳失敗');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // 🆕 使用新的 Gemini Vision API 分析參考圖
    const handleAIDescribe = async () => {
        if (!editingRef) return;

        setIsDescribing(true);

        try {
            // Convert URL to base64 if needed
            const imageBase64 = await fetch(editingRef.url)
                .then(res => res.blob())
                .then(blob => {
                    return new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                    });
                });

            const response = await fetch('/api/openrouter/analyze-reference', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    imageBase64,
                    angle: editingRef.angle || 'front',
                    type: editingRef.type,
                    userNote: userNote.trim() || undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'AI 分析失敗');
            }

            setEditingRef({
                ...editingRef,
                description: data.description,
                aiDescription: data.description,  // 🆕 儲存 AI 描述
                mustKeepFeatures: data.analysis?.mustKeep || [],
                identityCore: data.analysis?.identityCore,
                styleTraits: data.analysis?.styleTraits,
                angleVisibility: data.analysis?.angleVisibility,
                guidelines: data.analysis?.mustKeep?.length
                    ? `不可改變：${data.analysis.mustKeep.join('；')}`
                    : editingRef.guidelines,
                structuredIdentityLock: buildStructuredIdentityLock({
                    type: editingRef.type,
                    description: data.description,
                    identityCore: data.analysis?.identityCore,
                    mustKeepFeatures: data.analysis?.mustKeep || [],
                    guidelines: data.analysis?.mustKeep?.length
                        ? `不可改變：${data.analysis.mustKeep.join('；')}`
                        : editingRef.guidelines,
                }),
                descriptionSource: 'ai',
            });
        } catch (error) {
            console.error('AI describe error:', error);
            alert(error instanceof Error ? error.message : 'AI 分析失敗');
        } finally {
            setIsDescribing(false);
        }
    };

    const handleSaveRef = () => {
        if (!editingRef || !editingRef.description.trim()) {
            alert('請輸入描述');
            return;
        }

        onChange([...references, editingRef]);
        setEditingRef(null);
        setUserNote('');  // 重置使用者說明
    };

    const handleRemoveRef = (id: string) => {
        onChange(references.filter(r => r.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    參考圖片 (選填)
                </label>
                <span className="text-xs text-slate-500">
                    {references.length} 張
                </span>
            </div>

            {/* 已上傳的參考圖列表 */}
            {references.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                    {references.map((ref) => (
                        <div
                            key={ref.id}
                            className="relative group bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700"
                        >
                            <img
                                src={ref.url}
                                alt={ref.description}
                                className="w-full h-24 object-cover"
                            />
                            <div className="p-2">
                                <div className="flex items-center gap-1 mb-1">
                                    <span className={`
                                        text-xs px-1.5 py-0.5 rounded
                                        ${ref.type === 'character' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                                            ref.type === 'environment' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                                                'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}
                                    `}>
                                        {TYPE_OPTIONS.find(t => t.value === ref.type)?.label}
                                    </span>
                                    {ref.name && (
                                        <span className="text-xs text-slate-500">&lt;{ref.name}&gt;</span>
                                    )}
                                    {ref.descriptionSource === 'ai' && (
                                        <Sparkles className="w-3 h-3 text-amber-500" />
                                    )}
                                </div>
                                <div className="flex items-center gap-1 mb-1">
                                    {ref.angle && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                            {ANGLE_OPTIONS.find(a => a.value === ref.angle)?.emoji} {ANGLE_OPTIONS.find(a => a.value === ref.angle)?.label}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                    {ref.description}
                                </p>
                            </div>
                            <button
                                onClick={() => handleRemoveRef(ref.id)}
                                disabled={disabled}
                                className="absolute top-1 right-1 p-1 bg-red-500/90 hover:bg-red-600 
                                         rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <X className="w-3 h-3 text-white" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* 編輯中的參考圖 */}
            {editingRef && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3">
                    <div className="flex gap-3">
                        <img
                            src={editingRef.url}
                            alt="New reference"
                            className="w-24 h-24 object-cover rounded-lg"
                        />
                        <div className="flex-1 space-y-2">
                            {/* 類別選擇 */}
                            <div className="flex gap-2">
                                {TYPE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setEditingRef({ ...editingRef, type: opt.value })}
                                        className={`
                                            px-2 py-1 text-xs rounded-lg transition-colors
                                            ${editingRef.type === opt.value
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                            }
                                        `}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>

                            {/* 🆕 視角選擇 (只在商品和角色時顯示) */}
                            {(editingRef.type === 'product' || editingRef.type === 'character') && (
                                <div>
                                    <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">視角</label>
                                    <div className="flex gap-1.5">
                                        {ANGLE_OPTIONS.map((angle) => (
                                            <button
                                                key={angle.value}
                                                onClick={() => setEditingRef({ ...editingRef, angle: angle.value })}
                                                className={`
                                                    px-2 py-1 text-xs rounded transition-colors flex items-center gap-1
                                                    ${editingRef.angle === angle.value
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                    }
                                                `}
                                                title={angle.label}
                                            >
                                                <span>{angle.emoji}</span>
                                                <span className="hidden sm:inline">{angle.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 名稱（角色和商品顯示） */}
                            {(editingRef.type === 'character' || editingRef.type === 'product') && (
                                <input
                                    type="text"
                                    placeholder={editingRef.type === 'character' ? '角色名稱（如 Alice）' : '商品名稱（如 iPhone）'}
                                    value={editingRef.name || ''}
                                    onChange={(e) => setEditingRef({ ...editingRef, name: e.target.value })}
                                    className="w-full px-2 py-1 text-sm bg-white dark:bg-slate-800 
                                             border border-slate-300 dark:border-slate-600 rounded-lg
                                             focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            )}
                        </div>
                    </div>

                    {/* 參考說明輸入框 */}
                    <div>
                        <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                            參考說明（選填）
                        </label>
                        <input
                            type="text"
                            placeholder="提供額外資訊給 AI 參考，例如：商品名稱、特殊材質、風格偏好等"
                            value={userNote}
                            onChange={(e) => setUserNote(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-slate-800
                                     border border-slate-300 dark:border-slate-600 rounded-lg
                                     focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    {/* 描述輸入 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                描述
                            </label>
                            <button
                                onClick={handleAIDescribe}
                                disabled={isDescribing}
                                className="flex items-center gap-1 px-2 py-1 text-xs
                                         bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50
                                         text-amber-700 dark:text-amber-300 rounded-lg transition-colors
                                         disabled:opacity-50"
                            >
                                {isDescribing ? (
                                    <>
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        分析中...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-3 h-3" />
                                        AI 自動描述
                                    </>
                                )}
                            </button>
                        </div>
                        <textarea
                            value={editingRef.description}
                            onChange={(e) => setEditingRef({
                                ...editingRef,
                                description: e.target.value,
                                descriptionSource: 'manual'
                            })}
                            placeholder={
                                editingRef.type === 'character'
                                    ? '描述角色外觀、服裝、姿勢、視角...'
                                    : editingRef.type === 'product'
                                        ? '描述商品外觀、材質、細節、視角...'
                                        : editingRef.type === 'environment'
                                            ? '描述場景、光線、氛圍...'
                                            : '描述視覺風格、色調...'
                            }
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 
                                     border border-slate-300 dark:border-slate-600 rounded-lg
                                     focus:outline-none focus:ring-1 focus:ring-blue-500
                                     resize-none"
                            rows={2}
                        />
                    </div>

                    {/* 操作按鈕 */}
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setEditingRef(null)}
                            className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400 
                                     hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={handleSaveRef}
                            disabled={!editingRef.description.trim()}
                            className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 
                                     text-white rounded-lg transition-colors
                                     disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            確認新增
                        </button>
                    </div>
                </div>
            )}

            {/* 上傳按鈕 */}
            {!editingRef && (
                <label
                    className={`
                        flex items-center justify-center gap-2 w-full py-3
                        border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg
                        cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10
                        transition-colors
                        ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                            <span className="text-sm text-slate-500">上傳中...</span>
                        </>
                    ) : (
                        <>
                            <Plus className="w-5 h-5 text-slate-500" />
                            <span className="text-sm text-slate-500">新增參考圖</span>
                        </>
                    )}
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={disabled || isUploading}
                    />
                </label>
            )}

            {/* 提示 */}
            {references.length === 0 && !editingRef && (
                <p className="text-xs text-slate-500 text-center">
                    上傳角色或場景參考圖，AI 會據此生成一致的分鏡描述
                </p>
            )}
        </div>
    );
}
