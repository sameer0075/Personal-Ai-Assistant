import { apiFetch, apiJson } from "./client";

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  isDefault: boolean;
}

export interface Workspace {
  id: string;
  kind: "personal" | "work";
  name: string;
  departments: Department[];
}

export function listWorkspaces(): Promise<Workspace[]> {
  return apiFetch<Workspace[]>("/workspaces");
}

export function createDepartment(name: string, parentId?: string | null): Promise<Department> {
  return apiJson<Department>("/workspaces/departments", "POST", { name, parentId });
}

export function updateDepartment(id: string, name: string): Promise<{ updated: boolean }> {
  return apiJson<{ updated: boolean }>(`/workspaces/departments/${id}`, "PATCH", { name });
}

export function deleteDepartment(id: string): Promise<void> {
  return apiJson<void>(`/workspaces/departments/${id}`, "DELETE");
}