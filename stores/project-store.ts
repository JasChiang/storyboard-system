import { create } from 'zustand';
import { Project } from '@/lib/types/project';
import { projectStorage } from '@/lib/db/local-storage';

interface ProjectStore {
  // 狀態
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;

  // 動作
  loadProjects: () => void;
  setCurrentProject: (projectId: string | null) => void;
  createProject: (name: string, description?: string) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  refreshCurrentProject: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  // 初始狀態
  projects: [],
  currentProject: null,
  isLoading: false,

  // 載入所有專案
  loadProjects: () => {
    set({ isLoading: true });
    const projects = projectStorage.getAll();
    set({ projects, isLoading: false });
  },

  // 設定當前專案
  setCurrentProject: (projectId: string | null) => {
    if (!projectId) {
      set({ currentProject: null });
      return;
    }

    const project = projectStorage.getById(projectId);
    set({ currentProject: project });
  },

  // 建立專案
  createProject: (name: string, description?: string) => {
    const newProject = projectStorage.create({
      name,
      description,
      status: 'draft',
    });

    const projects = projectStorage.getAll();
    set({ projects, currentProject: newProject });

    return newProject;
  },

  // 更新專案
  updateProject: (id: string, updates: Partial<Project>) => {
    const updatedProject = projectStorage.update(id, updates);

    if (updatedProject) {
      const projects = projectStorage.getAll();
      set({ projects });

      // 如果更新的是當前專案，也更新 currentProject
      const { currentProject } = get();
      if (currentProject?.id === id) {
        set({ currentProject: updatedProject });
      }
    }
  },

  // 刪除專案
  deleteProject: (id: string) => {
    projectStorage.delete(id);
    const projects = projectStorage.getAll();

    const { currentProject } = get();
    set({
      projects,
      currentProject: currentProject?.id === id ? null : currentProject,
    });
  },

  // 重新載入當前專案
  refreshCurrentProject: () => {
    const { currentProject } = get();
    if (currentProject) {
      const refreshed = projectStorage.getById(currentProject.id);
      set({ currentProject: refreshed });
    }
  },
}));
