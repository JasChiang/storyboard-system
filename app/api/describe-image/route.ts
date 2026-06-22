import { NextRequest, NextResponse } from 'next/server';
import { API_ERROR_CODES, apiError, apiErrorFromUnknown } from '@/lib/api/errors';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_APP_ORIGIN = 'http://localhost:3000';

function getServerAppOrigin() {
    return process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN || DEFAULT_APP_ORIGIN;
}

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
        const body = await request.json();
        if (Object.prototype.hasOwnProperty.call(body, 'apiKey')) {
            return apiError(API_ERROR_CODES.INVALID_INPUT, 'Client-provided apiKey is not allowed');
        }

        const { imageUrl, type } = body;
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!imageUrl || !type) {
            return apiError(API_ERROR_CODES.MISSING_FIELD, '缺少必要參數 imageUrl/type');
        }
        if (!apiKey) {
            return apiError(API_ERROR_CODES.SERVER_MISCONFIGURED, '伺服器未設定 OPENROUTER_API_KEY');
        }

        const prompt = PROMPTS_BY_TYPE[type] || PROMPTS_BY_TYPE.character;
        const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4.6';

        const response = await fetch(OPENROUTER_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': getServerAppOrigin(),
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
        return apiErrorFromUnknown(error, { message: '描述失敗' });
    }
}
