import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/api/fal';

/**
 * @deprecated 此端點已被 Server Proxy 取代
 *
 * 舊方案：文件 → 此端點（伺服器）→ Fal Storage（慢，消耗頻寬）
 * 新方案：文件 → /api/fal/proxy → 直接到 Fal Storage（快，不消耗頻寬）
 *
 * 建議使用 @fal-ai/server-proxy 取代此端點
 * 參考：components/providers/FalConfigProvider.tsx
 */
export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        // 嘗試讀取環境變數中的 Fal API Key
        const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY;

        if (!file) {
            return NextResponse.json(
                { error: '未提供檔案' },
                { status: 400 }
            );
        }

        if (!apiKey) {
            return NextResponse.json(
                { error: '伺服器端 Fal API Key 未設定，且前端未提供 Key' },
                { status: 500 }
            );
        }

        console.log('正在透過伺服器代理上傳檔案到 Fal...');
        const url = await uploadFile(file, { apiKey });
        console.log('上傳成功:', url);

        return NextResponse.json({
            success: true,
            url,
        });
    } catch (error) {
        console.error('Fal upload proxy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '上傳失敗' },
            { status: 500 }
        );
    }
}
