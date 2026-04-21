import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideosForEditing } from '@/lib/api/gemini';
import type { UploadedFile } from '@/lib/api/gemini';
import type { Storyboard } from '@/lib/types/storyboard';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            uploadedFiles: UploadedFile[];
            storyboard: Storyboard;
        };
        if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
        }
        const { uploadedFiles, storyboard } = body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!uploadedFiles || !storyboard) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing required fields: uploadedFiles, storyboard');
        }
        if (!apiKey) {
            return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, 'Server GEMINI_API_KEY is not set');
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
        return apiErrorFromUnknown(error, { message: 'Analyze videos failed' });
    }
}
