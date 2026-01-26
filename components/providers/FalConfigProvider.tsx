'use client';

import { useEffect } from 'react';
import { fal } from '@fal-ai/client';

/**
 * 設定 Fal Client 使用 Server Proxy
 * 這樣前端可以直接上傳檔案到 Fal，但 API key 不會暴露在瀏覽器
 */
export function FalConfigProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // Best practice: production 使用 server proxy，避免在瀏覽器暴露 API key
        fal.config({
            proxyUrl: '/api/fal/proxy',
        });
        console.log('✅ Fal Client: 使用 Server Proxy（FAL_API_KEY）');
    }, []);

    return <>{children}</>;
}
