import type { PromptTemplate, ProjectReference } from '@/lib/types/storyboard';
import { buildConsolidatedReferenceRules } from '@/lib/references/consistency-rules';
import { buildIdentityLockPromptLine, buildStructuredIdentityLock } from '@/lib/references/identity-lock';

export interface BuildSystemPromptOptions {
    targetDurationSec?: number;
    targetSceneCount?: number;
}

/**
 * 根據參考圖資訊構建增強的系統提示詞
 */
export function buildSystemPrompt(
    template: PromptTemplate,
    references?: ProjectReference[],
    options?: BuildSystemPromptOptions
): string {
    let prompt = template.systemPrompt;

    if (references && references.length > 0) {
        const consolidatedRules = buildConsolidatedReferenceRules(references);
        // 整理角色、商品和環境參考
        const characterRefs = references.filter(r => r.type === 'character');
        const productRefs = references.filter(r => r.type === 'product');
        const environmentRefs = references.filter(r => r.type === 'environment');
        const styleRefs = references.filter(r => r.type === 'style');

        prompt += `\n\n---\n\n## 使用者已提供的參考圖\n\n`;

        const angleMap: Record<string, string> = {
            'front': 'Front View (正面)',
            'side': 'Side View (側面)',
            'three_quarter': '3/4 View (3/4側)',
            'back': 'Back View (背面)',
            'top': 'Top View (頂視)',
            'other': 'Other View'
        };

        if (characterRefs.length > 0) {
            prompt += `### 角色參考\n`;
            characterRefs.forEach(r => {
                const charName = r.name || '未命名角色';
                const angleInfo = r.angle ? ` [${angleMap[r.angle] || r.angle}]` : '';
                const guidelineText = r.guidelines ? ` | 規則：${r.guidelines}` : '';
                const identityText = r.identityCore ? ` | 核心：${r.identityCore}` : '';
                const mustKeepText = r.mustKeepFeatures?.length
                    ? ` | 不可改變：${r.mustKeepFeatures.join('、')}`
                    : '';
                const ipVersionText = r.ipProfile?.profileVersion ? ` | IP版本：v${r.ipProfile.profileVersion}` : '';
                const ipRuleText = r.ipProfile?.immutableRules?.length
                    ? ` | IP硬規則：${r.ipProfile.immutableRules.join('；')}`
                    : '';
                prompt += `- **<${charName}>**${angleInfo}: ${r.description}${identityText}${mustKeepText}${guidelineText}${ipVersionText}${ipRuleText}\n`;
            });
            prompt += '\n';
        }

        if (productRefs.length > 0) {
            prompt += `### 商品參考\n`;
            productRefs.forEach(r => {
                const prodName = r.name || '未命名商品';
                const angleInfo = r.angle ? ` [${angleMap[r.angle] || r.angle}]` : '';
                const identityText = r.identityCore ? ` | 核心：${r.identityCore}` : '';
                const mustKeepText = r.mustKeepFeatures?.length
                    ? ` | 不可改變：${r.mustKeepFeatures.join('、')}`
                    : '';
                const guidelineText = r.guidelines ? ` | 規則：${r.guidelines}` : '';
                const ipVersionText = r.ipProfile?.profileVersion ? ` | IP版本：v${r.ipProfile.profileVersion}` : '';
                const ipRuleText = r.ipProfile?.immutableRules?.length
                    ? ` | IP硬規則：${r.ipProfile.immutableRules.join('；')}`
                    : '';
                prompt += `- **<${prodName}>**${angleInfo}: ${r.description}${identityText}${mustKeepText}${guidelineText}${ipVersionText}${ipRuleText}\n`;
            });
            prompt += '\n';
        }

        if (environmentRefs.length > 0) {
            prompt += `### 環境參考\n`;
            environmentRefs.forEach(r => {
                prompt += `- ${r.description}\n`;
            });
            prompt += '\n';
        }

        if (styleRefs.length > 0) {
            prompt += `### 風格參考\n`;
            styleRefs.forEach(r => {
                prompt += `- ${r.description}\n`;
            });
            prompt += '\n';
        }

        if (consolidatedRules.length > 0) {
            prompt += `### 合併後一致性規則（多視角/多來源已整併）\n`;
            consolidatedRules.forEach(rule => {
                const coreText = rule.identityCore ? ` | 核心：${rule.identityCore}` : '';
                const mustKeepText = rule.mustKeepFeatures.length
                    ? ` | 不可改變：${rule.mustKeepFeatures.join('、')}`
                    : '';
                const guidelineText = rule.guidelines.length
                    ? ` | 規範：${rule.guidelines.join('；')}`
                    : '';
                const lock = rule.structuredIdentityLock
                    || buildStructuredIdentityLock({
                        type: rule.type,
                        identityCore: rule.identityCore,
                        mustKeepFeatures: rule.mustKeepFeatures,
                        guidelines: rule.guidelines.join('；'),
                        description: '',
                    });
                const lockText = lock ? ` | 結構化保真鎖：${buildIdentityLockPromptLine(lock, rule.tag)}` : '';
                prompt += `- ${rule.tag}${coreText}${mustKeepText}${guidelineText}${lockText}\n`;
            });
            prompt += '\n';
        }

        // 整理每個角色/商品的可用視角索引
        const angleIndexMap = new Map<string, string[]>();
        [...characterRefs, ...productRefs].forEach(r => {
            if (!r.name || !r.angle) return;
            const key = r.name;
            if (!angleIndexMap.has(key)) angleIndexMap.set(key, []);
            const angles = angleIndexMap.get(key)!;
            if (!angles.includes(r.angle)) angles.push(r.angle);
        });
        if (angleIndexMap.size > 0) {
            prompt += `### 可用視角索引（referenceViewHints 只能使用以下視角）\n`;
            angleIndexMap.forEach((angles, name) => {
                prompt += `- **<${name}>** 可用視角：${angles.join('、')}\n`;
            });
            prompt += `\n`;
        }

        // 加入額外規範
        prompt += `## ⚠️ 參考圖一致性規範

由於使用者已提供參考圖，請遵循以下規則：

1. **標記引用**：在 description 中使用 \`<名稱>\` 格式引用角色或商品
${characterRefs.map(r => `   - 使用 \`<${r.name || '角色'}>\` 指代該角色`).join('\n')}
${productRefs.map(r => `   - 使用 \`<${r.name || '商品'}>\` 指代該商品`).join('\n')}

2. **外觀省略**：不要描述角色或商品的外觀細節（如髮型、服裝、顏色、材質），這些已由參考圖定義

3. **專注描述**：description 應專注於：
   - 角色/商品在畫面中的位置（左側/右側/中央/前景/背景）
   - 面向的方向（facing left/right/camera/away）
   - 姿態、動作狀態、表情（針對角色）
   - 光線反射、擺放角度（針對商品）
   - 與其他元素的相對位置

4. **位置精確**：必須明確描述每個元素在畫面中的位置

5. **不可變特徵優先**：
   - 若參考圖提供「不可改變」條目，請在所有場景中保持一致
   - 只允許描述「位置、姿態、構圖、情緒、光線」的變化
   - 不可重新定義角色/商品的核心外觀

6. **結構化追蹤**：
   - 每個場景需輸出 \`charactersUsed\`（如 ["<Alice>"]）
   - 每個場景需輸出 \`productsUsed\`（如 ["<iPhone>"]）
   - 每個場景需輸出 \`changeFromPrev\`（若為第一場可填 "N/A"）
   - 每個場景需輸出 \`shotIntent\`（一句話描述鏡頭在敘事上的任務）
   - 每個場景需輸出 \`continuityAnchor\`（跨鏡頭必須維持的單一重點）
   - 每個場景需輸出 \`viewIntent\`（auto/front/side/back/three_quarter/top，用來決定本鏡主參考視角）
   - 每個場景需輸出 \`referenceViewHints\`（每個角色/商品標記的視角需求，如 {"<台灣男性>":"front","<Galaxy S26>":"back"}；若場景同時有角色與商品，必須分別標記，不可只靠單一 viewIntent；**只能填入「可用視角索引」中實際存在的視角，若無對應視角則填 "auto"**）
   - 每個場景需輸出 \`referencePlan\`（列出本鏡會實際依賴的每個角色/商品，例如 [{"tag":"<台灣男性>","entityType":"character","requestedView":"front","required":true},{"tag":"<Galaxy S26>","entityType":"product","requestedView":"back","required":true,"visibleFeatures":"背面鏡頭模組與品牌標誌"}]）
   - 若某個標記的 referenceViewHints 為非正面視角（side/back/three_quarter/top），description 必須描述從該視角可見的內容（例如：「<Galaxy S26> 背面朝向鏡頭，相機模組清晰可見」），讓圖片生成模型知道該視角要展示什麼特徵
   - 每個場景需輸出 \`requiredReferences\`（本鏡頭必須使用的標記陣列）

7. **一致性合併優先序**：
   - 若同角色/商品有多視角或多份參考，請以「合併後一致性規則」為最高準則
   - 不可在 description 重新定義已合併的核心外觀特徵

8. **文字與 Logo 可讀性規則**：
   - 若畫面中需出現可見文字 / Logo，必須保持拼寫與位置一致，不可新增變體
   - 若該鏡頭不需要文字，請避免描述任何新字樣或浮水印

✅ 正確範例：「Medium shot. <Alice> 在畫面左側，手持 <iPhone>，面向右方。柔和側光照射在 <iPhone> 的金屬邊框上。」
❌ 錯誤範例：「Alice（短髮女性）拿著黑色的 iPhone 16 Pro」
`;
    }

    // 使用者指定的時長/場景數動態提示
    const hints: string[] = [];
    if (typeof options?.targetDurationSec === 'number' && options.targetDurationSec > 0) {
        hints.push(`- 目標總時長：約 ${options.targetDurationSec} 秒（請讓所有 scene 的 duration 總和接近此值）`);
    }
    if (typeof options?.targetSceneCount === 'number' && options.targetSceneCount > 0) {
        hints.push(`- 使用者指定場景數：${options.targetSceneCount} 場（請嚴格遵守，不得增減）`);
    }
    if (hints.length > 0) {
        prompt += `\n\n## 本次生成參數（使用者指定）\n${hints.join('\n')}`;
    }

    return prompt;
}
