import { NextRequest, NextResponse } from 'next/server';
import { analyzeVideosForEditing } from '@/lib/api/gemini';
import type { UploadedFile } from '@/lib/api/gemini';
import type { Storyboard } from '@/lib/types/storyboard';

export async function POST(request: NextRequest) {
    try {
        const { uploadedFiles, storyboard, apiKey } = await request.json() as {
            uploadedFiles: UploadedFile[];
            storyboard: Storyboard;
            apiKey: string;
        };

        if (!uploadedFiles || !storyboard || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const suggestion = await analyzeVideosForEditing(
            uploadedFiles,
            storyboard,
            { apiKey }
        );

        return NextResponse.json({
            success: true,
            suggestion,
        });
    } catch (error) {
        console.error('Analyze videos error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
