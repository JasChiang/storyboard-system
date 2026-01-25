'use client';

import { useState, useRef } from 'react';
import { X, Image as ImageIcon } from 'lucide-react';
import { fal } from '@fal-ai/client';

interface ReferenceUploaderProps {
    value: string | null;
    onChange: (imageUrl: string | null) => void;
    disabled?: boolean;
}

export function ReferenceUploader({ value, onChange, disabled }: ReferenceUploaderProps) {
    const [preview, setPreview] = useState<string | null>(value);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 檢查檔案類型
        if (!file.type.startsWith('image/')) {
            alert('請上傳圖片檔案');
            return;
        }

        // 檢查檔案大小 (限制 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('圖片檔案過大，請上傳小於 10MB 的圖片');
            return;
        }

        setIsUploading(true);

        try {
            // 獲取 API Key（可選，後端有環境變數備援）
            const apiKey = localStorage.getItem('fal_api_key');

            // 創建本地預覽
            const localPreview = URL.createObjectURL(file);
            setPreview(localPreview);

            let uploadedUrl = '';

            if (apiKey) {
                // 有本地 Key，使用客戶端上傳
                fal.config({ credentials: apiKey });
                console.log('使用客戶端上傳到 Fal Storage...');
                uploadedUrl = await fal.storage.upload(file);
            } else {
                // 無本地 Key，嘗試使用伺服器端代理上傳
                console.log('使用伺服器端代理上傳...');
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('/api/fal/upload', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || '上傳失敗，請檢查伺服器 FAL_KEY 設定或在設定中輸入 API Key');
                }

                const data = await response.json();
                uploadedUrl = data.url;
            }

            console.log('上傳成功:', uploadedUrl);

            // 釋放本地預覽
            URL.revokeObjectURL(localPreview);

            // 設置上傳後的 URL
            setPreview(uploadedUrl);
            onChange(uploadedUrl);
        } catch (error) {
            console.error('Upload error:', error);
            alert(error instanceof Error ? error.message : '上傳失敗');
            setPreview(null);
            onChange(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = () => {
        if (preview && preview.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
        }
        setPreview(null);
        onChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                參考圖片 (選填)
            </label>

            {preview ? (
                <div className="relative group">
                    <img
                        src={preview}
                        alt="Reference"
                        className="w-full h-48 object-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/50"
                    />
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <p className="text-sm text-white">上傳到 Fal Storage...</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleRemove}
                        disabled={disabled || isUploading}
                        className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-600 
                     rounded-lg transition-colors opacity-0 group-hover:opacity-100
                     disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
            ) : (
                <label
                    className={`
            flex flex-col items-center justify-center w-full h-48
            border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg
            cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50
            transition-colors
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
                >
                    <div className="flex flex-col items-center justify-center p-6">
                        {isUploading ? (
                            <>
                                <div className="w-12 h-12 border-2 border-slate-300 dark:border-slate-600 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin mb-3" />
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                                    上傳中...
                                </p>
                            </>
                        ) : (
                            <>
                                <ImageIcon className="w-12 h-12 text-slate-400 mb-3" />
                                <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                                    點擊上傳參考圖片
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    PNG, JPG, WEBP (最大 10MB)
                                </p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                                    上傳到 Fal Storage
                                </p>
                            </>
                        )}
                    </div>
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
        </div>
    );
}
