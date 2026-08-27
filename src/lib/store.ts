import { create } from 'zustand';
import { ReadinessProject, ProjectState } from '../types';

interface GlobalState {
  projects: ReadinessProject[];
  loading: boolean;
  walletTokens: number;
  fetchProjects: () => Promise<void>;
  fetchWallet: (userId: string) => Promise<void>;
  updateProjectLocally: (project: ReadinessProject) => void;
}

export const useStore = create<GlobalState>((set) => ({
  projects: [],
  loading: true,
  walletTokens: 0,
  fetchProjects: async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      set({ projects: data.projects || [], loading: false });
    } catch (e) {
      console.error(e);
      set({ loading: false });
    }
  },
  fetchWallet: async (userId: string) => {
    try {
      const res = await fetch(`/api/wallet/${userId}`);
      const data = await res.json();
      set({ walletTokens: data.balance || 0 });
    } catch (e) {
      console.error(e);
    }
  },
  updateProjectLocally: (updatedProject) => {
    set((state) => ({
      projects: state.projects.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    }));
  }
}));
