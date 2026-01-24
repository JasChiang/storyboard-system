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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 檢查檔案類型
        if (!file.type.startsWith('image/')) {
            alert('請上傳圖片檔案');
            return;
        }

        // 轉換為 base64
        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setPreview(result);
            onChange(result);
        };
        reader.readAsDataURL(file);
    };

    const handleRemove = () => {
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
                    <button
                        onClick={handleRemove}
                        disabled={disabled}
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
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
                >
                    <div className="flex flex-col items-center justify-center p-6">
                        <ImageIcon className="w-12 h-12 text-zinc-500 mb-3" />
                        <p className="text-sm text-zinc-400 text-center">
                            點擊上傳參考圖片
                        </p>
                        <p className="text-xs text-zinc-600 mt-1">
                            PNG, JPG, WEBP
                        </p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={disabled}
                    />
                </label>
            )}
        </div>
    );
}
