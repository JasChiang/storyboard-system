'use client';

import { useEffect } from 'react';
import { fal } from '@fal-ai/client';

/**
 * 設定 Fal Client 使用 Server Proxy
 * 這樣前端可以直接上傳檔案到 Fal，但 API key 不會暴露在瀏覽器
 */
export function FalConfigProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // 檢查是否有本機 API key
        const localApiKey = localStorage.getItem('fal_api_key');

        if (localApiKey) {
            // 如果使用者設定了自己的 API key，直接使用
            fal.config({
                credentials: localApiKey,
            });
            console.log('✅ Fal Client: 使用本機 API key');
        } else {
            // 否則使用 server proxy（後端環境變數）
            fal.config({
                proxyUrl: '/api/fal/proxy',
            });
            console.log('✅ Fal Client: 使用 Server Proxy（後端環境變數）');
        }

        // 監聽 localStorage 變化（當使用者在設定中更新 API key）
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'fal_api_key') {
                if (e.newValue) {
                    fal.config({
                        credentials: e.newValue,
                    });
                    console.log('🔄 Fal Client: 切換到本機 API key');
                } else {
                    fal.config({
                        proxyUrl: '/api/fal/proxy',
                    });
                    console.log('🔄 Fal Client: 切換到 Server Proxy');
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return <>{children}</>;
}
