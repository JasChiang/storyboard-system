/**
 * 全局角色庫本地儲存管理
 */

import type { CharacterLibrary, CharacterLibraryItem } from '@/lib/types/character-library';

const STORAGE_KEY = 'storyboard_character_library';

class CharacterLibraryStorage {
  private getLibrary(): CharacterLibrary {
    if (typeof window === 'undefined') {
      return { items: [], version: 1 };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { items: [], version: 1 };
    }

    try {
      return JSON.parse(stored) as CharacterLibrary;
    } catch {
      return { items: [], version: 1 };
    }
  }

  private saveLibrary(library: CharacterLibrary): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  }

  /**
   * 取得所有角色
   */
  getAll(): CharacterLibraryItem[] {
    return this.getLibrary().items;
  }

  /**
   * 根据 ID 取得单个角色
   */
  getById(id: string): CharacterLibraryItem | undefined {
    return this.getLibrary().items.find(item => item.id === id);
  }

  /**
   * 新增角色
   */
  add(item: Omit<CharacterLibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): CharacterLibraryItem {
    const library = this.getLibrary();
    const newItem: CharacterLibraryItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usageCount: 0,
    };

    library.items.push(newItem);
    this.saveLibrary(library);
    return newItem;
  }

  /**
   * 更新角色
   */
  update(id: string, updates: Partial<Omit<CharacterLibraryItem, 'id' | 'createdAt' | 'usageCount'>>): void {
    const library = this.getLibrary();
    const index = library.items.findIndex(item => item.id === id);

    if (index === -1) {
      throw new Error('角色不存在');
    }

    library.items[index] = {
      ...library.items[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveLibrary(library);
  }

  /**
   * 刪除角色
   */
  delete(id: string): void {
    const library = this.getLibrary();
    library.items = library.items.filter(item => item.id !== id);
    this.saveLibrary(library);
  }

  /**
   * 增加使用次數
   */
  incrementUsage(id: string): void {
    const library = this.getLibrary();
    const item = library.items.find(item => item.id === id);

    if (item) {
      item.usageCount += 1;
      this.saveLibrary(library);
    }
  }

  /**
   * 搜尋角色
   */
  search(query: string): CharacterLibraryItem[] {
    const lowerQuery = query.toLowerCase();
    return this.getLibrary().items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      item.description.toLowerCase().includes(lowerQuery) ||
      (item.guidelines || '').toLowerCase().includes(lowerQuery) ||
      item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * 按類型篩選
   */
  filterByType(type: CharacterLibraryItem['type']): CharacterLibraryItem[] {
    return this.getLibrary().items.filter(item => item.type === type);
  }

  /**
   * 清空角色庫（谨慎使用）
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const characterLibraryStorage = new CharacterLibraryStorage();
