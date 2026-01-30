/**
 * 全局角色库（Global Character Library）
 * 用于存储可复用的 IP 角色、商品、风格等参考资源
 */

import type { ProjectReference } from './storyboard';

export interface CharacterLibraryItem {
  id: string;
  name: string;                    // 角色名称（如 "吉祥物小熊"）
  type: 'character' | 'product' | 'environment' | 'style';
  description: string;              // 全局描述
  guidelines?: string;              // 規則/限制（提供給生成提示詞）
  tags: string[];                   // 标签（用于搜索和分类）

  // 多视角参考图
  views: {
    angle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other';
    url: string;                    // Fal Storage URL
    description: string;            // 该视角的描述
  }[];

  // 元数据
  createdAt: string;
  updatedAt: string;
  usageCount: number;               // 被引用次数
}

export interface CharacterLibrary {
  items: CharacterLibraryItem[];
  version: number;                  // 用于未来迁移
}

/**
 * 将角色库项目转换为 ProjectReference 格式
 */
export function characterLibraryItemToProjectReference(
  item: CharacterLibraryItem,
  selectedAngle: 'front' | 'side' | 'three_quarter' | 'back' | 'top' | 'other' = 'front'
): ProjectReference {
  const view = item.views.find(v => v.angle === selectedAngle) || item.views[0];

  if (!view) {
    throw new Error(`角色 ${item.name} 没有可用的视角图片`);
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
