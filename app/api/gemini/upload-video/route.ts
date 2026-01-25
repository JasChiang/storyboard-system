import { NextRequest, NextResponse } from 'next/server';
import { uploadVideoToGemini } from '@/lib/api/gemini';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('video') as File;
        const apiKey = (formData.get('apiKey') as string) || process.env.GEMINI_API_KEY;

        if (!file || !apiKey) {
            return NextResponse.json(
                { error: 'Missing required fields (video or apiKey)' },
                { status: 400 }
            );
        }

        const uploadedFile = await uploadVideoToGemini(file, { apiKey });

        return NextResponse.json({
            success: true,
            file: uploadedFile,
        });
    } catch (error) {
        console.error('Upload video error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
