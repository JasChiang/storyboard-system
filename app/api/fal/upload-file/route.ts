import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/api/fal';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const apiKey = formData.get('apiKey') as string;

        if (!file || !apiKey) {
            return NextResponse.json(
                { error: 'Missing file or API key' },
                { status: 400 }
            );
        }

        const fileUrl = await uploadFile(file, { apiKey });

        return NextResponse.json({ url: fileUrl });
    } catch (error) {
        console.error('Upload file error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
