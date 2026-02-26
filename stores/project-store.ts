import { create } from 'zustand';
import type { Project } from '@/lib/types/project';
import { projectStorage } from '@/lib/db/local-storage';

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  isCurrentProjectLoading: boolean;
  loadProjects: () => void;
  setCurrentProject: (projectId: string | null) => void;
  createProject: (name: string, description?: string, targetDurationSec?: number) => Promise<Project | null>;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  refreshCurrentProject: () => void;
}

let currentProjectRequestSeq = 0;

async function apiGetProjects(): Promise<Project[]> {
  const response = await fetch('/api/data/projects');
  if (!response.ok) throw new Error('Failed to fetch projects');
  const json = await response.json();
  return json.data as Project[];
}

async function apiGetProjectById(id: string): Promise<Project | null> {
  const response = await fetch(`/api/data/projects/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to fetch project');
  const json = await response.json();
  return json.data as Project;
}

async function apiCreateProject(name: string, description?: string, targetDurationSec?: number): Promise<Project> {
  const response = await fetch('/api/data/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, targetDurationSec }),
  });
  if (!response.ok) throw new Error('Failed to create project');
  const json = await response.json();
  return json.data as Project;
}

async function apiUpdateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
  const response = await fetch(`/api/data/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Failed to update project');
  const json = await response.json();
  return json.data as Project;
}

async function apiDeleteProject(id: string): Promise<boolean> {
  const response = await fetch(`/api/data/projects/${id}`, { method: 'DELETE' });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error('Failed to delete project');
  return true;
}

async function apiImportProjects(projects: Project[]): Promise<void> {
  const response = await fetch('/api/data/projects/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects }),
  });
  if (!response.ok) throw new Error('Failed to import projects');
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  isCurrentProjectLoading: false,

  loadProjects: () => {
    void (async () => {
      set({ isLoading: true });
      try {
        let projects = await apiGetProjects();
        if (projects.length === 0) {
          const local = projectStorage.getAll();
          if (local.length > 0) {
            await apiImportProjects(local);
            projects = await apiGetProjects();
          }
        }
        set({ projects, isLoading: false });
      } catch {
        const fallback = projectStorage.getAll();
        set({ projects: fallback, isLoading: false });
      }
    })();
  },

  setCurrentProject: (projectId: string | null) => {
    if (!projectId) {
      currentProjectRequestSeq += 1;
      set({ currentProject: null, isCurrentProjectLoading: false });
      return;
    }

    const requestSeq = ++currentProjectRequestSeq;
    set({ currentProject: null, isCurrentProjectLoading: true });
    void (async () => {
      try {
        const project = await apiGetProjectById(projectId);
        if (requestSeq !== currentProjectRequestSeq) return;
        set({ currentProject: project, isCurrentProjectLoading: false });
      } catch {
        const fallback = projectStorage.getById(projectId);
        if (requestSeq !== currentProjectRequestSeq) return;
        set({ currentProject: fallback, isCurrentProjectLoading: false });
      }
    })();
  },

  createProject: async (name: string, description?: string, targetDurationSec?: number) => {
    try {
      const created = await apiCreateProject(name, description, targetDurationSec);
      const projects = await apiGetProjects();
      set({ projects, currentProject: created });
      return created;
    } catch {
      const local = projectStorage.create({ name, description, status: 'draft', targetDurationSec });
      const projects = projectStorage.getAll();
      set({ projects, currentProject: local });
      return local;
    }
  },

  updateProject: (id: string, updates: Partial<Project>) => {
    void (async () => {
      try {
        const updated = await apiUpdateProject(id, updates);
        if (!updated) return;

        const projects = await apiGetProjects();
        const { currentProject } = get();
        set({
          projects,
          currentProject: currentProject?.id === id ? updated : currentProject,
        });
      } catch {
        const updated = projectStorage.update(id, updates);
        if (!updated) return;

        const projects = projectStorage.getAll();
        const { currentProject } = get();
        set({
          projects,
          currentProject: currentProject?.id === id ? updated : currentProject,
        });
      }
    })();
  },

  deleteProject: (id: string) => {
    void (async () => {
      try {
        await apiDeleteProject(id);
        const projects = await apiGetProjects();
        const { currentProject } = get();
        set({
          projects,
          currentProject: currentProject?.id === id ? null : currentProject,
        });
      } catch {
        projectStorage.delete(id);
        const projects = projectStorage.getAll();
        const { currentProject } = get();
        set({
          projects,
          currentProject: currentProject?.id === id ? null : currentProject,
        });
      }
    })();
  },

  refreshCurrentProject: () => {
    void (async () => {
      const { currentProject } = get();
      if (!currentProject) return;

      set({ isCurrentProjectLoading: true });
      try {
        const refreshed = await apiGetProjectById(currentProject.id);
        set({ currentProject: refreshed, isCurrentProjectLoading: false });
      } catch {
        const refreshed = projectStorage.getById(currentProject.id);
        set({ currentProject: refreshed, isCurrentProjectLoading: false });
      }
    })();
  },
}));
