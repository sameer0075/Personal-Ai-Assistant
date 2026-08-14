import { randomUUID } from "node:crypto";
import path from "node:path";

export interface ProjectInfo {
  id: string;
  root: string;
  name: string; // basename of root, for display in the sidebar
}

const projects = new Map<string, ProjectInfo>();
let activeProjectId: string | null = null;

export function addProject(root: string): ProjectInfo {
  // Re-opening a folder that's already open just re-activates it,
  // rather than spawning a second server for the same root.
  const existing = [...projects.values()].find((p) => p.root === root);
  if (existing) {
    activeProjectId = existing.id;
    return existing;
  }

  const project: ProjectInfo = { id: randomUUID(), root, name: path.basename(root) };
  projects.set(project.id, project);
  activeProjectId = project.id;
  return project;
}

export function removeProject(id: string): void {
  projects.delete(id);
  if (activeProjectId === id) {
    const remaining = [...projects.keys()];
    activeProjectId = remaining.length ? remaining[remaining.length - 1] : null;
  }
}

export function setActiveProject(id: string): void {
  if (!projects.has(id)) throw new Error(`Unknown project id "${id}"`);
  activeProjectId = id;
}

export function getProject(id: string): ProjectInfo | undefined {
  return projects.get(id);
}

export function getActiveProjectId(): string | null {
  return activeProjectId;
}

export function listProjects(): ProjectInfo[] {
  return [...projects.values()];
}