"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { listWorkspaces, type Workspace } from "@/lib/api/workspaces";
import { useAuth } from "@/lib/auth/AuthProvider";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  setActiveWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshWorkspaces = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const items = await listWorkspaces();
      setWorkspaces(items);
      setActiveWorkspaceId((current) => {
        const stored = typeof window !== "undefined" ? window.localStorage.getItem("activeWorkspaceId") : null;
        const next = (current && items.some((item) => item.id === current) ? current : null)
          ?? (stored && items.some((item) => item.id === stored) ? stored : null)
          ?? items[0]?.id ?? null;
        if (next && typeof window !== "undefined") window.localStorage.setItem("activeWorkspaceId", next);
        return next;
      });
    } catch {
      setWorkspaces([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoadingAuth || !user) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      return;
    }

    void refreshWorkspaces();
  }, [user, isLoadingAuth, refreshWorkspaces]);

  const value = {
    workspaces,
    activeWorkspace: workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    isLoading,
    refreshWorkspaces,
    setActiveWorkspaceId: (id: string) => {
      setActiveWorkspaceId(id);
      if (typeof window !== "undefined") window.localStorage.setItem("activeWorkspaceId", id);
    },
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return context;
}