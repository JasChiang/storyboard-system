import { NextRequest, NextResponse } from 'next/server';
import { generateImage } from '@/lib/api/fal';

export async function POST(request: NextRequest) {
  try {
    const { prompt, referenceImage, aspectRatio, resolution, apiKey } = await request.json();

    if (!prompt || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await generateImage(
      prompt,
      {
        referenceImage,
        aspectRatio,
        resolution,
      },
      { apiKey }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Generate image error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
