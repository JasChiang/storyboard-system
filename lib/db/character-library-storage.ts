/**
 * 角色庫儲存：SQLite API 為主，localStorage 為 fallback。
 */

import type { CharacterLibrary, CharacterLibraryItem } from '@/lib/types/character-library';
import { CHARACTER_LIBRARY_SCHEMA_VERSION, migrateCharacterLibrary, normalizeCharacterItem } from '@/lib/characters/workflow';

const STORAGE_KEY = 'storyboard_character_library';

class CharacterLibraryStorage {
  private getLocalLibrary(): CharacterLibrary {
    if (typeof window === 'undefined') return { items: [], version: CHARACTER_LIBRARY_SCHEMA_VERSION };

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { items: [], version: CHARACTER_LIBRARY_SCHEMA_VERSION };

    try {
      return migrateCharacterLibrary(JSON.parse(stored) as CharacterLibrary);
    } catch {
      return { items: [], version: CHARACTER_LIBRARY_SCHEMA_VERSION };
    }
  }

  private saveLocalLibrary(library: CharacterLibrary): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  }

  private async importLocalToApiIfNeeded(remoteItems: CharacterLibraryItem[]): Promise<void> {
    if (typeof window === 'undefined') return;
    if (remoteItems.length > 0) return;

    const localItems = this.getLocalLibrary().items;
    if (!localItems.length) return;

    const response = await fetch('/api/data/character-library/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: localItems }),
    });
    if (!response.ok) {
      throw new Error('Failed to import character library');
    }
  }

  async getAll(): Promise<CharacterLibraryItem[]> {
    try {
      const response = await fetch('/api/data/character-library');
      if (!response.ok) throw new Error('Failed to fetch character library');
      const json = await response.json();
      const remote = (json.data || []) as CharacterLibraryItem[];

      await this.importLocalToApiIfNeeded(remote);
      if (remote.length === 0) {
        const retry = await fetch('/api/data/character-library');
        if (retry.ok) {
          const retryJson = await retry.json();
          const retryItems = (retryJson.data || []) as CharacterLibraryItem[];
          if (retryItems.length === 0) {
            const localItems = this.getLocalLibrary().items;
            if (localItems.length > 0) {
              return localItems;
            }
          }
          const normalizedRetryItems = retryItems.map((item) => normalizeCharacterItem(item));
          this.saveLocalLibrary({ items: normalizedRetryItems, version: CHARACTER_LIBRARY_SCHEMA_VERSION });
          return normalizedRetryItems;
        }
        const localItems = this.getLocalLibrary().items;
        if (localItems.length > 0) {
          return localItems;
        }
      }

      const normalizedRemote = remote.map((item) => normalizeCharacterItem(item));
      this.saveLocalLibrary({ items: normalizedRemote, version: CHARACTER_LIBRARY_SCHEMA_VERSION });
      return normalizedRemote;
    } catch {
      return this.getLocalLibrary().items;
    }
  }

  async getById(id: string): Promise<CharacterLibraryItem | undefined> {
    try {
      const response = await fetch(`/api/data/character-library/${id}`);
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error('Failed to fetch character library item');
      const json = await response.json();
      return normalizeCharacterItem(json.data as CharacterLibraryItem);
    } catch {
      return this.getLocalLibrary().items.find((item) => item.id === id);
    }
  }

  async add(item: Omit<CharacterLibraryItem, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'version' | 'currentSnapshotId'>): Promise<CharacterLibraryItem> {
    try {
      const response = await fetch('/api/data/character-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });

      if (!response.ok) throw new Error('Failed to create character library item');
      const json = await response.json();
      const created = normalizeCharacterItem(json.data as CharacterLibraryItem);
      const items = await this.getAll();
      this.saveLocalLibrary({ items, version: CHARACTER_LIBRARY_SCHEMA_VERSION });
      return created;
    } catch {
      const library = this.getLocalLibrary();
      const created: CharacterLibraryItem = {
        ...normalizeCharacterItem(item),
        id: crypto.randomUUID(),
        version: 1,
        currentSnapshotId: `snapshot-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
      };
      library.items.push(created);
      this.saveLocalLibrary(library);
      return created;
    }
  }

  async update(id: string, updates: Partial<Omit<CharacterLibraryItem, 'id' | 'createdAt' | 'usageCount'>>): Promise<void> {
    try {
      const response = await fetch(`/api/data/character-library/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update character library item');
      const items = await this.getAll();
      this.saveLocalLibrary({ items, version: CHARACTER_LIBRARY_SCHEMA_VERSION });
      return;
    } catch {
      const library = this.getLocalLibrary();
      const index = library.items.findIndex((x) => x.id === id);
      if (index === -1) throw new Error('角色不存在');
      const previous = library.items[index];
      const shouldBumpVersion = Object.keys(updates).some((key) => key !== 'usageCount');
      library.items[index] = normalizeCharacterItem({
        ...previous,
        ...updates,
        version: shouldBumpVersion ? (previous.version || 1) + 1 : previous.version || 1,
        currentSnapshotId: shouldBumpVersion ? `snapshot-${crypto.randomUUID()}` : previous.currentSnapshotId,
        updatedAt: new Date().toISOString(),
      });
      this.saveLocalLibrary(library);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const response = await fetch(`/api/data/character-library/${id}`, { method: 'DELETE' });
      if (!response.ok && response.status !== 404) throw new Error('Failed to delete character library item');
      const items = await this.getAll();
      this.saveLocalLibrary({ items, version: CHARACTER_LIBRARY_SCHEMA_VERSION });
      return;
    } catch {
      const library = this.getLocalLibrary();
      library.items = library.items.filter((item) => item.id !== id);
      this.saveLocalLibrary(library);
    }
  }

  async incrementUsage(id: string): Promise<void> {
    try {
      await fetch(`/api/data/character-library/${id}/increment-usage`, { method: 'POST' });
      return;
    } catch {
      const library = this.getLocalLibrary();
      const item = library.items.find((x) => x.id === id);
      if (item) {
        item.usageCount += 1;
        this.saveLocalLibrary(library);
      }
    }
  }

  async search(query: string): Promise<CharacterLibraryItem[]> {
    const lowerQuery = query.toLowerCase();
    const items = await this.getAll();
    return items.filter(item =>
      item.name.toLowerCase().includes(lowerQuery) ||
      (item.identityAnchor || item.description || '').toLowerCase().includes(lowerQuery) ||
      (item.guidelines || '').toLowerCase().includes(lowerQuery) ||
      (item.tags ?? []).some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async filterByType(type: CharacterLibraryItem['type']): Promise<CharacterLibraryItem[]> {
    const items = await this.getAll();
    return items.filter(item => item.type === type);
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const characterLibraryStorage = new CharacterLibraryStorage();
