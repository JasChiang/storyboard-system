import { NextRequest, NextResponse } from 'next/server';
import { analyzeReferenceImage } from '@/lib/api/openrouter';

export const maxDuration = 60;

interface StructuredReferenceAnalysis {
    description: string;
    mustKeep: string[];
    identityCore?: string;
    materialLighting?: string;
    styleTraits?: string;
    angleVisibility?: string;
}

/**
 * OpenRouter Vision API for Reference Image Analysis
 * Automatically generates detailed visual descriptions for uploaded reference images using OpenRouter models
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { imageBase64, angle, type, userNote } = body;

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

        const systemPrompt = buildAnalysisPrompt(typeLabel, angleLabel, userNote);

        // Call OpenRouter
        const rawAnalysis = await analyzeReferenceImage(
            imageBase64,
            systemPrompt,
            { apiKey }
        );
        const analysis = parseStructuredAnalysis(rawAnalysis);

        return NextResponse.json({
            success: true,
            description: analysis.description,
            analysis,
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
function buildAnalysisPrompt(type: string, angle: string, userNote?: string): string {
    const angleInstructions: Record<string, string> = {
        front: '正面視角的',
        side: '側面視角的',
        three_quarter: '3/4 側面視角的',
        back: '背面視角的',
        top: '頂部俯視的',
        other: '',
    };

    const angleDesc = angleInstructions[angle] || '';
    const userNoteSection = userNote
        ? `\n使用者補充：${userNote}`
        : '';

    const typeFocus: Record<string, string> = {
        product: '重點提取不可變商品特徵：外型輪廓、比例、Logo 位置、按鍵/介面配置、材質細節。',
        character: '重點提取不可變角色特徵：臉型與五官、髮型、服裝結構與代表性配件。',
        environment: '重點提取不可變場景特徵：主要構圖元素、空間關係、光源方向與色調。',
        style: '重點提取風格語言：筆觸/材質、色彩處理、光影語法、畫面顆粒或渲染方式。',
    };

    return `你是影像生成前處理器。請分析一張${angleDesc || ''}${type}參考圖，並輸出結構化 JSON。
${typeFocus[type] || typeFocus.product}
${userNoteSection}

嚴格規則：
1) 只描述圖中看得見的內容，不可臆測不可見部分。
2) 不要輸出任何 JSON 以外內容。
3) mustKeep 必須是「不可改變」的關鍵項目，3-8 點，簡短可執行。
4) description 請是可直接注入到影像生成 prompt 的單段文字（80-180 字）。

輸出 JSON 結構（鍵名不可更改）：
{
  "description": "string",
  "mustKeep": ["string", "string"],
  "identityCore": "string",
  "materialLighting": "string",
  "styleTraits": "string",
  "angleVisibility": "string"
}`;
}

function parseStructuredAnalysis(raw: string): StructuredReferenceAnalysis {
    const cleaned = raw
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/, '');

    try {
        const parsed = JSON.parse(cleaned) as Partial<StructuredReferenceAnalysis>;
        const mustKeep = Array.isArray(parsed.mustKeep)
            ? parsed.mustKeep.map(item => String(item).trim()).filter(Boolean)
            : [];

        const description = String(parsed.description || '').trim();
        const fallbackDescription = [
            parsed.identityCore,
            parsed.materialLighting,
            parsed.styleTraits,
            parsed.angleVisibility,
        ]
            .filter(Boolean)
            .map(item => String(item).trim())
            .join('；');

        return {
            description: description || fallbackDescription || cleaned,
            mustKeep,
            identityCore: parsed.identityCore?.trim(),
            materialLighting: parsed.materialLighting?.trim(),
            styleTraits: parsed.styleTraits?.trim(),
            angleVisibility: parsed.angleVisibility?.trim(),
        };
    } catch {
        // 向後相容：若模型回傳純文字，仍可繼續使用
        return {
            description: cleaned,
            mustKeep: [],
        };
    }
}
