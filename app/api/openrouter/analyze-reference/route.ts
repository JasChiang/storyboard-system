import { NextRequest, NextResponse } from 'next/server';
import { analyzeReferenceImage } from '@/lib/api/openrouter';

export const maxDuration = 60;

/**
 * OpenRouter Vision API for Reference Image Analysis
 * Automatically generates detailed visual descriptions for uploaded reference images using OpenRouter models
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageBase64, angle, type } = body;

        if (!imageBase64) {
            return NextResponse.json(
                { success: false, error: '缺少圖片資料' },
                { status: 400 }
            );
        }

        // Get API key from body or env
        const apiKey = body.apiKey || process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { success: false, error: '未設定 OpenRouter API Key' },
                { status: 500 }
            );
        }

        // Build angle-specific prompt
        const angleLabel = angle || 'main';
        const typeLabel = type || 'product';

        const systemPrompt = buildAnalysisPrompt(typeLabel, angleLabel);

        // Call OpenRouter
        const description = await analyzeReferenceImage(
            imageBase64,
            systemPrompt,
            { apiKey }
        );

        return NextResponse.json({
            success: true,
            description,
            metadata: {
                angle: angleLabel,
                type: typeLabel,
            },
        });
    } catch (error) {
        console.error('Reference analysis error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '分析失敗',
            },
            { status: 500 }
        );
    }
}

/**
 * Build angle and type specific analysis prompt
 */
function buildAnalysisPrompt(type: string, angle: string): string {
    const angleInstructions: Record<string, string> = {
        front: '正面視角的',
        side: '側面視角的',
        three_quarter: '3/4 側面視角的',
        back: '背面視角的',
        top: '頂部俯視的',
        other: '',
    };

    const angleDesc = angleInstructions[angle] || '';

    if (type === 'product') {
        return `請以專業影像生成模型的視角，極度詳細地分析這張${angleDesc}商品參考圖。

請描述：
1. **幾何形狀**：整體輪廓、比例、尺寸特徵
2. **材質紋理**：表面材質（金屬、塑膠、玻璃、布料等）、反光特性、質感細節（如磨砂、拋光、紋理）
3. **顏色與光影**：主色調、色彩分布、高光與陰影位置、環境反射
4. **品牌元素**：Logo 位置、大小、顏色、字體特徵；包裝文字的可讀性與排版
5. **特殊細節**：水珠、灰塵、磨損、光澤、透明度等視覺細節
6. **構圖與角度**：該${angleDesc}視角下的特定可見元素與遮蔽元素

⚠️ 重要：
- 使用具體、可視覺化的語言，避免抽象形容詞
- 專注於「靜態視覺特徵」，不要描述動作或假設的用途
- 如果是${angleDesc}視角，請特別強調在這個角度下可見的獨特特徵`;
    } else if (type === 'character') {
        return `請詳細描述這個角色的${angleDesc}外觀特徵，供影像生成模型使用。

請描述：
1. **身體特徵**：身高比例、體型、姿態
2. **臉部特徵**：五官特點、表情、膚色
3. **髮型與髮色**：長度、樣式、顏色、質感
4. **服裝**：款式、顏色、材質、配件
5. **整體風格**：寫實、卡通、動漫等視覺風格

⚠️ 使用客觀、具體的描述，避免主觀評價。`;
    } else if (type === 'environment') {
        return `請詳細描述這個${angleDesc}環境場景，供影像生成模型使用。

請描述：
1. **空間類型**：室內/室外、場所類別
2. **光線條件**：自然光/人工光、明暗對比、光源方向
3. **主要元素**：建築、家具、植被、道具等位置與特徵
4. **氛圍與色調**：整體色彩、氣氛感受
5. **景深與構圖**：前景、中景、背景的層次關係

⚠️ 專注於視覺可重現的元素。`;
    } else {
        return `請詳細描述這張${angleDesc}參考圖的視覺特徵，供影像生成模型使用。請使用具體、可視覺化的語言。`;
    }
}
