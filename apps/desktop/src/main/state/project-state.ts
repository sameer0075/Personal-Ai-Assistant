let currentProjectRoot: string | null = null;

export function getProjectRoot(): string | null {
  return currentProjectRoot;
}

export function setProjectRootState(root: string): void {
  currentProjectRoot = root;
}