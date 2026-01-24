import { Project } from '../types/project';

const STORAGE_KEY = 'storyboard-projects';
const API_KEYS_KEY = 'storyboard-api-keys';

// 專案 CRUD 操作
export const projectStorage = {
  // 獲取所有專案
  getAll(): Project[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  // 獲取單個專案
  getById(id: string): Project | null {
    const projects = this.getAll();
    return projects.find(p => p.id === id) || null;
  },

  // 建立專案
  create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const newProject: Project = {
      ...project,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const projects = this.getAll();
    projects.push(newProject);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));

    return newProject;
  },

  // 更新專案
  update(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>): Project | null {
    const projects = this.getAll();
    const index = projects.findIndex(p => p.id === id);

    if (index === -1) return null;

    projects[index] = {
      ...projects[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return projects[index];
  },

  // 刪除專案
  delete(id: string): boolean {
    const projects = this.getAll();
    const filtered = projects.filter(p => p.id !== id);

    if (filtered.length === projects.length) return false;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },
};

// API 金鑰管理
export interface ApiKeys {
  openrouter?: string;
  fal?: string;
  gemini?: string;
}

export const apiKeyStorage = {
  // 獲取所有 API 金鑰
  getAll(): ApiKeys {
    if (typeof window === 'undefined') return {};
    const data = localStorage.getItem(API_KEYS_KEY);
    return data ? JSON.parse(data) : {};
  },

  // 設定 API 金鑰
  set(keys: Partial<ApiKeys>): void {
    const current = this.getAll();
    const updated = { ...current, ...keys };
    localStorage.setItem(API_KEYS_KEY, JSON.stringify(updated));
  },

  // 清除所有 API 金鑰
  clear(): void {
    localStorage.removeItem(API_KEYS_KEY);
  },
};

// 生成唯一 ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
