import { create } from 'zustand';
import type { Project } from '@/lib/types/project';
import { projectStorage } from '@/lib/db/local-storage';

interface ProjectStore {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  loadProjects: () => void;
  setCurrentProject: (projectId: string | null) => void;
  createProject: (name: string, description?: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  refreshCurrentProject: () => void;
}

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

async function apiCreateProject(name: string, description?: string): Promise<Project> {
  const response = await fetch('/api/data/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
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
  await fetch('/api/data/projects/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects }),
  });
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,

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
      set({ currentProject: null });
      return;
    }

    void (async () => {
      try {
        const project = await apiGetProjectById(projectId);
        set({ currentProject: project });
      } catch {
        const fallback = projectStorage.getById(projectId);
        set({ currentProject: fallback });
      }
    })();
  },

  createProject: (name: string, description?: string) => {
    void (async () => {
      try {
        const created = await apiCreateProject(name, description);
        const projects = await apiGetProjects();
        set({ projects, currentProject: created });
      } catch {
        const local = projectStorage.create({ name, description, status: 'draft' });
        const projects = projectStorage.getAll();
        set({ projects, currentProject: local });
      }
    })();
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

      try {
        const refreshed = await apiGetProjectById(currentProject.id);
        set({ currentProject: refreshed });
      } catch {
        const refreshed = projectStorage.getById(currentProject.id);
        set({ currentProject: refreshed });
      }
    })();
  },
}));
