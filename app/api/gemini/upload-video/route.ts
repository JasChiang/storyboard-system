import { NextRequest, NextResponse } from 'next/server';
import { uploadVideoToGemini } from '@/lib/api/gemini';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        if (formData.has('apiKey')) {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
        }

        const file = formData.get('video') as File;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!file) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, 'Missing required field: video');
        }
        if (!apiKey) {
            return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, 'Server GEMINI_API_KEY is not set');
        }

        const uploadedFile = await uploadVideoToGemini(file, { apiKey });

        return NextResponse.json({
            success: true,
            file: uploadedFile,
        });
    } catch (error) {
        console.error('Upload video error:', error);
        return apiErrorFromUnknown(error, { message: 'Upload video failed' });
    }
}
