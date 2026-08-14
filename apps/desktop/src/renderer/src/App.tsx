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
import ChatPanel, { type ChatMessage } from "./components/ChatPanel";
import ProjectSwitcher from "./components/ProjectSwitcher";

import { tokens } from "./theme/theme";

interface ProjectInfo {
  id: string;
  root: string;
  name: string;
}

// Per-project UI state, so switching the active project preserves exactly
// what you had open — same expectation as VS Code/Cursor workspaces.
interface ProjectUiState {
  tabs: OpenTab[];
  activePath: string | null;
  treeVersion: number;
  messages: ChatMessage[];
}

function emptyUiState(): ProjectUiState {
  return { tabs: [], activePath: null, treeVersion: 0, messages: [] };
}

export default function App() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [uiByProject, setUiByProject] = useState<Map<string, ProjectUiState>>(new Map());
  const [notice, setNotice] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const activeUi = activeProjectId ? uiByProject.get(activeProjectId) ?? emptyUiState() : null;

  function updateUi(projectId: string, patch: Partial<ProjectUiState>) {
    setUiByProject((prev) => {
      const next = new Map(prev);
      const current = next.get(projectId) ?? emptyUiState();
      next.set(projectId, { ...current, ...patch });
      return next;
    });
  }

  // Pick up already-open projects if the window reloads mid-session.
  useEffect(() => {
    (async () => {
      const [list, active] = await Promise.all([window.api.listProjects(), window.api.getActiveProject()]);
      setProjects(list);
      setActiveProjectId(active);
      setUiByProject(new Map(list.map((p) => [p.id, emptyUiState()])));
    })();
  }, []);

  async function handleOpenFolder() {
    const project = await window.api.openFolder();
    if (!project) return;

    setProjects((prev) => (prev.some((p) => p.id === project.id) ? prev : [...prev, project]));
    setUiByProject((prev) => (prev.has(project.id) ? prev : new Map(prev).set(project.id, emptyUiState())));
    setActiveProjectId(project.id);
  }

  async function handleSwitchProject(projectId: string) {
    await window.api.switchProject(projectId);
    setActiveProjectId(projectId);
  }

  async function handleCloseProject(projectId: string) {
    await window.api.closeProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setUiByProject((prev) => {
      const next = new Map(prev);
      next.delete(projectId);
      return next;
    });
    if (activeProjectId === projectId) {
      const remaining = projects.filter((p) => p.id !== projectId);
      const nextActive = remaining.length ? remaining[remaining.length - 1].id : null;
      setActiveProjectId(nextActive);
      if (nextActive) await window.api.switchProject(nextActive);
    }
  }

  const openFile = useCallback(
    async (path: string) => {
      if (!activeProjectId || !activeUi) return;
      updateUi(activeProjectId, { activePath: path });
      if (activeUi.tabs.some((t) => t.path === path)) return;

      try {
        const content = await window.api.readFile(activeProjectId, path);
        updateUi(activeProjectId, { tabs: [...activeUi.tabs, { path, content, isDirty: false }] });
      } catch (err) {
        setNotice({ message: err instanceof Error ? err.message : "Failed to open file", severity: "error" });
      }
    },
    [activeProjectId, activeUi]
  );

  function closeTab(path: string) {
    if (!activeProjectId || !activeUi) return;
    const tabs = activeUi.tabs.filter((t) => t.path !== path);
    const activePath = activeUi.activePath === path ? (tabs.length ? tabs[tabs.length - 1].path : null) : activeUi.activePath;
    updateUi(activeProjectId, { tabs, activePath });
  }

  function updateContent(path: string, content: string) {
    if (!activeProjectId || !activeUi) return;
    const tabs = activeUi.tabs.map((t) => (t.path === path ? { ...t, content, isDirty: true } : t));
    updateUi(activeProjectId, { tabs });
  }

  const saveFile = useCallback(
    async (path: string) => {
      if (!activeProjectId || !activeUi) return;
      const tab = activeUi.tabs.find((t) => t.path === path);
      if (!tab) return;
      try {
        await window.api.saveFile(activeProjectId, path, tab.content);
        updateUi(activeProjectId, {
          tabs: activeUi.tabs.map((t) => (t.path === path ? { ...t, isDirty: false } : t)),
        });
      } catch (err) {
        setNotice({ message: err instanceof Error ? err.message : "Failed to save file", severity: "error" });
      }
    },
    [activeProjectId, activeUi]
  );

  const sendMessage = useCallback(
    async (message: string) => {
      if (!activeProjectId) return;
      const userMsg: ChatMessage = { role: "user", content: message };
      const current = uiByProject.get(activeProjectId) ?? emptyUiState();
      updateUi(activeProjectId, { messages: [...current.messages, userMsg] });

      const result = await window.api.sendMessage(activeProjectId, message);
      const latest = uiByProject.get(activeProjectId) ?? current;
      updateUi(activeProjectId, {
        messages: [...latest.messages, userMsg, { role: "assistant", content: result.answer, toolCalls: result.toolCalls }],
      });
    },
    [activeProjectId, uiByProject]
  );

  // The agent edits files through a separate process (a project-scoped MCP
  // server) — route the refresh only to the project that actually changed.
  useEffect(() => {
    return window.api.onExternalFileChange(async (projectId, paths) => {
      const ui = uiByProject.get(projectId);
      if (!ui) return;

      let tabs = ui.tabs;
      for (const path of paths) {
        if (!tabs.some((t) => t.path === path)) continue;
        try {
          const content = await window.api.readFile(projectId, path);
          tabs = tabs.map((t) => (t.path === path ? { ...t, content, isDirty: false } : t));
        } catch {
          // file may have been deleted by the agent - leave the tab as-is.
        }
      }
      updateUi(projectId, { tabs, treeVersion: ui.treeVersion + 1 });
    });
  }, [uiByProject]);

  if (!activeProjectId || !activeUi) {
    return (
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, bgcolor: tokens.bg }}>
        <CodeRoundedIcon sx={{ fontSize: 40, color: tokens.accentBright }} />
        <Typography sx={{ fontSize: 15, color: tokens.text }}>No project open</Typography>
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
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitch={handleSwitchProject}
        onClose={handleCloseProject}
        onAddFolder={handleOpenFolder}
      />

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1, px: 2, py: 1, borderBottom: `1px solid ${tokens.border}` }}>
          <CodeRoundedIcon sx={{ fontSize: 16, color: tokens.accentBright }} />
          <Typography sx={{ fontSize: 12.5, color: tokens.muted, fontFamily: "monospace" }}>
            {projects.find((p) => p.id === activeProjectId)?.root}
          </Typography>
        </Stack>

        <Box sx={{ flex: 1, display: "flex", minHeight: 0 }}>
          <Box sx={{ width: 240, flexShrink: 0, borderRight: `1px solid ${tokens.border}` }}>
            <FileTree
              key={`${activeProjectId}-${activeUi.treeVersion}`}
              projectId={activeProjectId}
              activePath={activeUi.activePath}
              onFileClick={openFile}
            />
          </Box>

          <EditorPane
            tabs={activeUi.tabs}
            activePath={activeUi.activePath}
            onSelectTab={(path) => updateUi(activeProjectId, { activePath: path })}
            onCloseTab={closeTab}
            onContentChange={updateContent}
            onSave={saveFile}
          />

          <ChatPanel
            key={activeProjectId}
            projectId={activeProjectId}
            projectOpen={Boolean(activeProjectId)}
            activePath={activeUi.activePath}
            openPaths={activeUi.tabs.map((t) => t.path)}
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
    </Box>
  );
}