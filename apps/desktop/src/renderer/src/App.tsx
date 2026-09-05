import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import FileTree from "./components/FileTree";
import EditorPane, { type OpenTab } from "./components/EditorPane";
import ChatPanel from "./components/ChatPanel";
import ProjectSwitcher from "./components/ProjectSwitcher";
import PendingChangeDialog, { type PendingFileChange } from "./components/PendingChangeDialog";

import { tokens } from "./theme/theme";

interface WorkspaceRoot {
  name: string;
  root: string;
}

interface WorkspaceInfo {
  id: string;
  key: string;
  name: string;
  roots: WorkspaceRoot[];
}

// Per-workspace UI state, so switching workspace preserves exactly what you
// had open — same expectation as VS Code/Cursor workspaces.
interface WorkspaceUiState {
  tabs: OpenTab[];
  activePath: string | null;
  treeVersion: number;
}

function emptyUiState(): WorkspaceUiState {
  return { tabs: [], activePath: null, treeVersion: 0 };
}

export default function App() {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [uiByWorkspace, setUiByWorkspace] = useState<Map<string, WorkspaceUiState>>(new Map());
  const [notice, setNotice] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  // Every write_file/edit_file/delete_file/create_directory call the agent
  // makes waits here for a decision - queued FIFO in case several land
  // before the user gets to them (e.g. edits across multiple files in one turn).
  const [pendingChanges, setPendingChanges] = useState<PendingFileChange[]>([]);

  useEffect(() => {
    return window.api.onPendingFileChange((change) => {
      setPendingChanges((prev) => [...prev, change]);
    });
  }, []);

  function respondToPendingChange(id: string, approved: boolean) {
    window.api.respondToPendingFileChange(id, approved);
    setPendingChanges((prev) => prev.filter((c) => c.id !== id));
  }

  const activeUi = activeWorkspaceId ? uiByWorkspace.get(activeWorkspaceId) ?? emptyUiState() : null;

  function updateUi(workspaceId: string, patch: Partial<WorkspaceUiState>) {
    setUiByWorkspace((prev) => {
      const next = new Map(prev);
      const current = next.get(workspaceId) ?? emptyUiState();
      next.set(workspaceId, { ...current, ...patch });
      return next;
    });
  }

  // Pick up already-open workspaces if the window reloads mid-session.
  useEffect(() => {
    (async () => {
      const [list, active] = await Promise.all([window.api.listProjects(), window.api.getActiveProject()]);
      setWorkspaces(list);
      setActiveWorkspaceId(active);
      setUiByWorkspace(new Map(list.map((w) => [w.id, emptyUiState()])));
    })();
  }, []);

  async function handleOpenFolder() {
    const workspace = await window.api.openFolder();
    if (!workspace) return;

    setWorkspaces((prev) => (prev.some((w) => w.id === workspace.id) ? prev : [...prev, workspace]));
    setUiByWorkspace((prev) => (prev.has(workspace.id) ? prev : new Map(prev).set(workspace.id, emptyUiState())));
    setActiveWorkspaceId(workspace.id);
  }

  /** Adds another repo to a workspace so they share one chat (Cursor-style). */
  async function handleAddRepo(workspaceId: string) {
    const workspace = await window.api.addRootToWorkspace(workspaceId);
    if (!workspace) return;
    setWorkspaces((prev) => prev.map((w) => (w.id === workspace.id ? workspace : w)));
    setUiByWorkspace((prev) => (prev.has(workspace.id) ? prev : new Map(prev).set(workspace.id, emptyUiState())));
    setActiveWorkspaceId(workspace.id);
  }

  async function handleSwitchWorkspace(workspaceId: string) {
    await window.api.switchProject(workspaceId);
    setActiveWorkspaceId(workspaceId);
  }

  async function handleCloseWorkspace(workspaceId: string) {
    await window.api.closeProject(workspaceId);
    setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
    setUiByWorkspace((prev) => {
      const next = new Map(prev);
      next.delete(workspaceId);
      return next;
    });
    if (activeWorkspaceId === workspaceId) {
      const remaining = workspaces.filter((w) => w.id !== workspaceId);
      const nextActive = remaining.length ? remaining[remaining.length - 1].id : null;
      setActiveWorkspaceId(nextActive);
      if (nextActive) await window.api.switchProject(nextActive);
    }
  }

  /** Removes a repo from a workspace; if it was the last repo the whole workspace closes. */
  async function handleRemoveRepo(workspaceId: string, rootName: string) {
    const result = await window.api.removeRootFromWorkspace(workspaceId, rootName);

    if (result === null) {
      await handleCloseWorkspace(workspaceId);
      return;
    }

    setWorkspaces((prev) => prev.map((w) => (w.id === result.id ? result : w)));

    // Drop open tabs + active file that belonged to the removed repo.
    setUiByWorkspace((prev) => {
      const ui = prev.get(workspaceId);
      if (!ui) return prev;
      const inRoot = (p: string) => p === rootName || p.startsWith(`${rootName}/`);
      const tabs = ui.tabs.filter((t) => !inRoot(t.path));
      const activePath =
        ui.activePath && inRoot(ui.activePath) ? (tabs.length ? tabs[tabs.length - 1].path : null) : ui.activePath;
      const next = new Map(prev);
      next.set(workspaceId, { ...ui, tabs, activePath, treeVersion: ui.treeVersion + 1 });
      return next;
    });
  }

  const openFile = useCallback(
    async (path: string) => {
      if (!activeWorkspaceId || !activeUi) return;
      updateUi(activeWorkspaceId, { activePath: path });
      if (activeUi.tabs.some((t) => t.path === path)) return;

      try {
        const content = await window.api.readFile(activeWorkspaceId, path);
        updateUi(activeWorkspaceId, { tabs: [...activeUi.tabs, { path, content, isDirty: false }] });
      } catch (err) {
        setNotice({ message: err instanceof Error ? err.message : "Failed to open file", severity: "error" });
      }
    },
    [activeWorkspaceId, activeUi]
  );

  function closeTab(path: string) {
    if (!activeWorkspaceId || !activeUi) return;
    const tabs = activeUi.tabs.filter((t) => t.path !== path);
    const activePath = activeUi.activePath === path ? (tabs.length ? tabs[tabs.length - 1].path : null) : activeUi.activePath;
    updateUi(activeWorkspaceId, { tabs, activePath });
  }

  function updateContent(path: string, content: string) {
    if (!activeWorkspaceId || !activeUi) return;
    const tabs = activeUi.tabs.map((t) => (t.path === path ? { ...t, content, isDirty: true } : t));
    updateUi(activeWorkspaceId, { tabs });
  }

  const saveFile = useCallback(
    async (path: string) => {
      if (!activeWorkspaceId || !activeUi) return;
      const tab = activeUi.tabs.find((t) => t.path === path);
      if (!tab) return;
      try {
        await window.api.saveFile(activeWorkspaceId, path, tab.content);
        updateUi(activeWorkspaceId, {
          tabs: activeUi.tabs.map((t) => (t.path === path ? { ...t, isDirty: false } : t)),
        });
      } catch (err) {
        setNotice({ message: err instanceof Error ? err.message : "Failed to save file", severity: "error" });
      }
    },
    [activeWorkspaceId, activeUi]
  );

  // The agent edits files through a separate process (a workspace-scoped MCP
  // server) — route the refresh only to the workspace that actually changed.
  useEffect(() => {
    return window.api.onExternalFileChange(async (workspaceId, paths) => {
      const ui = uiByWorkspace.get(workspaceId);
      if (!ui) return;

      let tabs = ui.tabs;
      for (const path of paths) {
        if (!tabs.some((t) => t.path === path)) continue;
        try {
          const content = await window.api.readFile(workspaceId, path);
          tabs = tabs.map((t) => (t.path === path ? { ...t, content, isDirty: false } : t));
        } catch {
          // file may have been deleted by the agent - leave the tab as-is.
        }
      }
      updateUi(workspaceId, { tabs, treeVersion: ui.treeVersion + 1 });
    });
  }, [uiByWorkspace]);

  const activeWorkspace = activeWorkspaceId ? workspaces.find((w) => w.id === activeWorkspaceId) : null;
  const activePath = activeUi?.activePath ?? null;
  const openPaths = activeUi?.tabs.map((t) => t.path) ?? [];

  if (!activeWorkspaceId || !activeWorkspace || !activeUi) {
    return (
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, bgcolor: tokens.bg }}>
        <CodeRoundedIcon sx={{ fontSize: 40, color: tokens.accentBright }} />
        <Typography sx={{ fontSize: 15, color: tokens.text }}>No workspace open</Typography>
        <Button
          variant="contained"
          startIcon={<FolderOpenRoundedIcon />}
          onClick={handleOpenFolder}
          sx={{ bgcolor: tokens.accent, color: "#04211d", "&:hover": { bgcolor: tokens.accentBright } }}
        >
          Open Folder
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100vh", display: "flex", bgcolor: tokens.bg }}>
      <ProjectSwitcher
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSwitch={handleSwitchWorkspace}
        onClose={handleCloseWorkspace}
        onAddWorkspace={handleOpenFolder}
        onAddRepoToActive={handleAddRepo}
      />

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, px: 2, py: 1, borderBottom: `1px solid ${tokens.border}` }}>
          <CodeRoundedIcon sx={{ fontSize: 16, color: tokens.accentBright }} />
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.text }}>
            {activeWorkspace.roots.map((r) => r.name).join(" + ")}
          </Typography>
          {activeWorkspace.roots.length > 1 && (
            <ChipLabel label={`${activeWorkspace.roots.length} repos`} />
          )}
        </Stack>

        <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
          <Box sx={{ width: 240, flexShrink: 0, borderRight: `1px solid ${tokens.border}` }}>
            <FileTree
              key={`${activeWorkspaceId}-${activeUi.treeVersion}`}
              workspaceId={activeWorkspaceId}
              roots={activeWorkspace.roots}
              activePath={activePath}
              onFileClick={openFile}
              onRemoveRoot={handleRemoveRepo}
            />
          </Box>

          <EditorPane
            tabs={activeUi.tabs}
            activePath={activePath}
            onSelectTab={(path) => updateUi(activeWorkspaceId, { activePath: path })}
            onCloseTab={closeTab}
            onContentChange={updateContent}
            onSave={saveFile}
          />

          <ChatPanel
            key={activeWorkspaceId}
            workspaceId={activeWorkspaceId}
            projectOpen={Boolean(activeWorkspaceId)}
            rootCount={activeWorkspace.roots.length}
            activePath={activePath}
            openPaths={openPaths}
          />
        </Box>
      </Box>

      <Snackbar open={notice !== null} autoHideDuration={4000} onClose={() => setNotice(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        {notice ? (
          <Alert severity={notice.severity} variant="filled" onClose={() => setNotice(null)}>
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>

      {(() => {
        const workspaceChanges = pendingChanges.filter((c) => c.workspaceId === activeWorkspaceId);
        const [current, ...rest] = workspaceChanges;
        if (!current) return null;
        return (
          <PendingChangeDialog
            change={current}
            queuedCount={rest.length}
            onRespond={(approved) => respondToPendingChange(current.id, approved)}
          />
        );
      })()}
    </Box>
  );
}

function ChipLabel({ label }: { label: string }) {
  return (
    <Typography
      sx={{
        fontSize: 10,
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        bgcolor: tokens.accentDim,
        color: tokens.accentBright,
      }}
    >
      {label}
    </Typography>
  );
}