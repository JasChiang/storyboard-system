import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideosForEditing } from '@/lib/api/gemini';
import type { UploadedFile } from '@/lib/api/gemini';
import type { Storyboard } from '@/lib/types/storyboard';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            uploadedFiles: UploadedFile[];
            storyboard: Storyboard;
            apiKey?: string;
        };
        const { uploadedFiles, storyboard } = body;
        const apiKey = body.apiKey || process.env.GEMINI_API_KEY;

        if (!uploadedFiles || !storyboard || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields (uploadedFiles, storyboard, or apiKey)' },
                { status: 400 }
            );
        }

        // 調試日誌：記錄傳遞給 Gemini 的影片資訊
        console.log('🎬 Gemini 影片分析請求:');
        console.log(`  - 影片數量: ${uploadedFiles.length}`);
        console.log(`  - 場景數量: ${storyboard.scenes.length}`);
        uploadedFiles.forEach((file, idx) => {
            console.log(`  - 影片 ${idx + 1}: ${file.name}`);
            console.log(`    URI: ${file.uri.substring(0, 60)}...`);
        });

        const suggestion = await analyzeVideosForEditing(
            uploadedFiles,
            storyboard,
            { apiKey }
        );

        // 調試日誌：檢查是否包含視覺確認
        const hasVisualConfirmation = suggestion.scenes?.some(s => s.visualConfirmation);
        console.log('✅ Gemini 分析完成:');
        console.log(`  - 包含視覺確認: ${hasVisualConfirmation ? '是 ✓' : '否 ⚠️'}`);
        if (hasVisualConfirmation) {
            const firstConfirmation = suggestion.scenes?.find(s => s.visualConfirmation);
            console.log(`  - 範例確認: "${firstConfirmation?.visualConfirmation}"`);
        }

        return NextResponse.json({
            success: true,
            suggestion,
        });
    } catch (error) {
        console.error('❌ Analyze videos error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
