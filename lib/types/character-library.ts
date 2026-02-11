/**
 * 全局角色庫（Global Character Library）
 * 用於儲存可重複使用的 IP 角色、商品、風格等參考資源
 */

import type { ProjectReference } from './storyboard';

export interface CharacterLibraryItem {
  id: string;
  name: string;                    // 角色名稱（如 "吉祥物小熊"）
  type: 'character' | 'product' | 'environment' | 'style';
  description: string;              // 全局描述
  guidelines?: string;              // 規則/限制（提供給生成提示詞）
  tags: string[];                   // 標籤（用於搜尋和分類）

  // 多視角參考圖
  views: {
    angle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';
    url: string;                    // Fal Storage URL
    description: string;            // 该視角的描述
  }[];

  // 中繼資料
  createdAt: string;
  updatedAt: string;
  usageCount: number;               // 被引用次數
}

export interface CharacterLibrary {
  items: CharacterLibraryItem[];
  version: number;                  // 用於未来迁移
}

/**
 * 將角色庫專案轉換為 ProjectReference 格式
 */
export function characterLibraryItemToProjectReference(
  item: CharacterLibraryItem,
  selectedAngle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other' = 'front'
): ProjectReference {
  const view = item.views.find(v => v.angle === selectedAngle) || item.views[0];

  if (!view) {
    throw new Error(`角色 ${item.name} 沒有可用的視角圖片`);
  }

  return {
    id: crypto.randomUUID(),
    url: view.url,
    description: view.description,
    type: item.type,
    name: item.name,
    angle: view.angle,
    descriptionSource: 'ai',
    guidelines: item.guidelines,
  };
}
