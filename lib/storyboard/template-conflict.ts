import type { ProjectReference } from '@/lib/types/storyboard';

export interface TemplateConflictInput {
  templateId: string;
  targetDurationSec: number;
  manualSceneCount?: number;
  references: ProjectReference[];
}

export interface TemplateConflictWarning {
  level: 'info' | 'warn';
  message: string;
}

export function detectTemplateConflicts({
  templateId,
  targetDurationSec,
  manualSceneCount,
  references,
}: TemplateConflictInput): TemplateConflictWarning[] {
  const warnings: TemplateConflictWarning[] = [];

  const hasProduct = references.some((ref) => ref.type === 'product');
  const hasCharacter = references.some((ref) => ref.type === 'character');

  if (templateId === 'shorts_hook') {
    if (targetDurationSec > 45) {
      warnings.push({
        level: 'warn',
        message: `Shorts 模板建議 ≤ 45 秒（目前 ${targetDurationSec} 秒）。考慮改用「商業廣告」或「科技產品」模板，或縮短時長以維持 Shorts 節奏。`,
      });
    }
    if (typeof manualSceneCount === 'number' && manualSceneCount > 6) {
      warnings.push({
        level: 'warn',
        message: `Shorts 模板建議 3-5 場（目前指定 ${manualSceneCount} 場）。場景過多會稀釋鉤子強度。`,
      });
    }
  }

  if (templateId === 'tech_product' || templateId === 'commercial') {
    if (!hasProduct) {
      warnings.push({
        level: 'info',
        message: '此模板聚焦產品展示，建議先在「參考圖片」加入一張商品圖以鎖定產品一致性。',
      });
    }
    if (typeof manualSceneCount === 'number' && manualSceneCount > 10) {
      warnings.push({
        level: 'warn',
        message: `${templateId === 'commercial' ? '商業廣告' : '科技產品'}模板預設 4-6 場（目前 ${manualSceneCount} 場），場景過多可能拖慢節奏。`,
      });
    }
  }

  if (templateId === 'documentary' && targetDurationSec < 15) {
    warnings.push({
      level: 'warn',
      message: `紀錄片模板建議 ≥ 30 秒（目前 ${targetDurationSec} 秒）。若是短片宣傳可改用「Shorts 病毒短片」模板。`,
    });
  }

  if (templateId === 'music_video' && targetDurationSec < 20) {
    warnings.push({
      level: 'info',
      message: `音樂 MV 通常 ≥ 30 秒（目前 ${targetDurationSec} 秒）。若是短版剪輯可接受，但節奏需更緊湊。`,
    });
  }

  if (references.length > 0 && !hasCharacter && !hasProduct && (templateId === 'default' || templateId === 'commercial')) {
    warnings.push({
      level: 'info',
      message: '目前參考圖僅為環境／風格類型。若本片有主角或商品，建議加入對應類型的參考以鎖定一致性。',
    });
  }

  return warnings;
}
