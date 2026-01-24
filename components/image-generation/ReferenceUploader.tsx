'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

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

        // 檢查檔案大小 (例如限制 10MB)
        if (file.size > 10 * 1024 * 1024) {
            alert('圖片檔案過大，請上傳小於 10MB 的圖片');
            return;
        }

        setIsUploading(true);

        try {
            // 獲取 API Key
            const apiKey = localStorage.getItem('fal_api_key');
            if (!apiKey) {
                alert('請先在設定中輸入 Fal AI API Key');
                return;
            }

            // 先創建本地預覽
            const localPreview = URL.createObjectURL(file);
            setPreview(localPreview);

            // 上傳到 Fal Storage
            const formData = new FormData();
            formData.append('file', file);
            formData.append('apiKey', apiKey);

            const response = await fetch('/api/fal/upload-file', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Upload failed');
            }

            // 釋放本地預覽 URL
            URL.revokeObjectURL(localPreview);

            // 使用上傳後的 URL
            setPreview(data.url);
            onChange(data.url);
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
            <label className="block text-sm font-medium text-zinc-300">
                參考圖片 (選填)
            </label>

            {preview ? (
                <div className="relative group">
                    <img
                        src={preview}
                        alt="Reference"
                        className="w-full h-48 object-contain rounded-lg border border-zinc-700 bg-zinc-900/50"
                    />
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <p className="text-sm text-white">上傳中...</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleRemove}
                        disabled={disabled || isUploading}
                        className="absolute top-2 right-2 p-2 bg-red-500/90 hover:bg-red-600 
                     rounded-lg transition-colors opacity-0 group-hover:opacity-100
                     disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <X className="w-4 h-4 text-white" />
                    </button>
                </div>
            ) : (
                <label
                    className={`
            flex flex-col items-center justify-center w-full h-48
            border-2 border-dashed border-zinc-700 rounded-lg
            cursor-pointer hover:border-zinc-600 hover:bg-zinc-900/30
            transition-colors
            ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
                >
                    <div className="flex flex-col items-center justify-center p-6">
                        {isUploading ? (
                            <>
                                <div className="w-12 h-12 border-2 border-zinc-500/30 border-t-zinc-500 rounded-full animate-spin mb-3" />
                                <p className="text-sm text-zinc-400 text-center">
                                    上傳中...
                                </p>
                            </>
                        ) : (
                            <>
                                <ImageIcon className="w-12 h-12 text-zinc-500 mb-3" />
                                <p className="text-sm text-zinc-400 text-center">
                                    點擊上傳參考圖片
                                </p>
                                <p className="text-xs text-zinc-600 mt-1">
                                    PNG, JPG, WEBP (最大 10MB)
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
