import { create } from 'zustand';
import { projectColorHex, type ApiProject } from '../api/client';

export interface ProjectTreeNode {
  id: string;
  name: string;
  color: string; // resolved hex for display
  colorName: string; // palette name for the API
  parentId: string | null;
  orderValue: number;
  isInbox: boolean;
  children: ProjectTreeNode[];
}

interface ProjectState {
  projects: ApiProject[];
  setProjects: (projects: ApiProject[]) => void;
  addProject: (project: ApiProject) => void;
  updateProject: (id: string, updates: Partial<ApiProject>) => void;
  removeProject: (id: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removeProject: (id) =>
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),
}));

// Build a nested, order-sorted tree from the flat project list. Inbox and
// archived projects are excluded — Inbox has its own top-level nav item.
export function buildProjectTree(projects: ApiProject[]): ProjectTreeNode[] {
  const visible = projects.filter((p) => !p.isArchived && !p.isInbox);
  const byId = new Map<string, ProjectTreeNode>();
  visible.forEach((p) =>
    byId.set(p.id, {
      id: p.id,
      name: p.name,
      color: projectColorHex(p.color),
      colorName: p.color,
      parentId: p.parentId,
      orderValue: p.orderValue,
      isInbox: p.isInbox,
      children: [],
    }),
  );

  const roots: ProjectTreeNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  const sortRec = (nodes: ProjectTreeNode[]) => {
    nodes.sort((a, b) => a.orderValue - b.orderValue || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}
