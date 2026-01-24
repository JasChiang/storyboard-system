import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const PROMPTS_BY_TYPE: Record<string, string> = {
    character: `Analyze this character reference image and describe:
- Physical features: age, gender, ethnicity, hair color/style, facial features
- Clothing and accessories
- Pose and expression  
- View angle (front view / side view / back view / 3/4 view)

Be concise and specific. Max 60 words. Output in the same language as this instruction's context or default to English.`,

    environment: `Analyze this environment/scene reference image and describe:
- Location type and setting
- Lighting conditions and atmosphere
- Key visual elements and composition
- Color palette and mood

Be concise and specific. Max 60 words.`,

    product: `Analyze this product reference image and describe:
- Product name and type if identifiable
- Key visual features: shape, logo, buttons, screen content
- Material and texture (metallic, matte, glossy, fabric, etc.)
- Color scheme
- View angle
- Lighting highlights

Be concise and specific. Max 60 words.`,

    style: `Analyze the visual style of this reference image and describe:
- Art style (realistic, anime, illustration, 3D render, etc.)
- Color palette and tones
- Rendering quality and technique
- Overall mood and aesthetic

Be concise and specific. Max 40 words.`
};

export async function POST(request: NextRequest) {
    try {
        const { imageUrl, type, apiKey } = await request.json();

        if (!imageUrl || !type || !apiKey) {
            return NextResponse.json(
                { error: '缺少必要參數' },
                { status: 400 }
            );
        }

        const prompt = PROMPTS_BY_TYPE[type] || PROMPTS_BY_TYPE.character;
        const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Storyboard System',
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image_url',
                                image_url: { url: imageUrl }
                            },
                            {
                                type: 'text',
                                text: prompt
                            }
                        ]
                    }
                ],
                max_tokens: 200,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        const description = data.choices?.[0]?.message?.content?.trim();

        if (!description) {
            throw new Error('AI 沒有返回描述');
        }

        return NextResponse.json({ description });
    } catch (error) {
        console.error('Describe image error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '描述失敗' },
            { status: 500 }
        );
    }
}
