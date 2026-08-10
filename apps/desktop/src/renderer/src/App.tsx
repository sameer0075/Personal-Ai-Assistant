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
import { tokens } from "./theme/theme";
import ActivityBar from "./components/ActivityBar";
import PendingChangeDialog, { type PendingFileChange } from "./components/PendingChangeDialog";

export default function App() {
  const [projectRoot, setProjectRoot] = useState<string | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [treeVersion, setTreeVersion] = useState(0); // bump to force the file tree to re-fetch
  const [notice, setNotice] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingFileChange[]>([]);

  // Pick up an already-open project if the window reloads mid-session (dev HMR, etc).
  useEffect(() => {
    window.api.getProjectRoot().then((root) => root && setProjectRoot(root));
  }, []);

  useEffect(() => {
    return window.api.onPendingChange((change) => {
      setPendingChanges((prev) => [...prev, change]);
    });
  }, []);

  function respondToPendingChange(approved: boolean) {
    const [current, ...rest] = pendingChanges;
    if (!current) return;
    window.api.respondToPendingChange(current.id, approved);
    setPendingChanges(rest);
  }

  const openFile = useCallback(
    async (path: string) => {
      setActivePath(path);
      if (tabs.some((t) => t.path === path)) return;

      try {
        const content = await window.api.readFile(path);
        setTabs((prev) => [...prev, { path, content, isDirty: false }]);
      } catch (err) {
        setNotice({ message: err instanceof Error ? err.message : "Failed to open file", severity: "error" });
      }
    },
    [tabs]
  );

  function closeTab(path: string) {
    setTabs((prev) => prev.filter((t) => t.path !== path));
    if (activePath === path) {
      const remaining = tabs.filter((t) => t.path !== path);
      setActivePath(remaining.length ? remaining[remaining.length - 1].path : null);
    }
  }

  function updateContent(path: string, content: string) {
    setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content, isDirty: true } : t)));
  }

  const saveFile = useCallback(
    async (path: string) => {
      const tab = tabs.find((t) => t.path === path);
      if (!tab) return;
      try {
        await window.api.saveFile(path, tab.content);
        setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, isDirty: false } : t)));
      } catch (err) {
        setNotice({ message: err instanceof Error ? err.message : "Failed to save file", severity: "error" });
      }
    },
    [tabs]
  );

  // The agent edits files through a separate process (the filesystem MCP
  // server) - this is how the editor finds out and stays in sync, rather than
  // silently going stale.
  useEffect(() => {
    return window.api.onExternalFileChange(async (paths) => {
      setTreeVersion((v) => v + 1);

      for (const path of paths) {
        if (!tabs.some((t) => t.path === path)) continue;
        try {
          const content = await window.api.readFile(path);
          setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content, isDirty: false } : t)));
        } catch {
          // file may have been deleted by the agent - just leave the tab showing its last content
        }
      }
    });
  }, [tabs]);

  async function handleOpenFolder() {
    const root = await window.api.openFolder();
    if (!root) return;
    setProjectRoot(root);
    setTabs([]);
    setActivePath(null);
    setTreeVersion((v) => v + 1);
  }

if (!projectRoot) {
  return (
    <Box
      sx={{
        height: "100vh",
        bgcolor: tokens.editor,

        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack
        sx={{
          width: 420,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <CodeRoundedIcon
          sx={{
            fontSize: 52,
            color: tokens.mutedDim,
            mb: 2,
          }}
        />

        <Typography
          sx={{
            fontSize: 22,
            fontWeight: 300,
            color: tokens.textBright,
            mb: 1,
          }}
        >
          Welcome to your AI Code Editor
        </Typography>

        <Typography
          sx={{
            fontSize: 13,
            color: tokens.muted,
            lineHeight: 1.6,
            mb: 3,
          }}
        >
          Open a project to start editing,
          exploring your code, and working
          with the coding agent.
        </Typography>

        <Button
          variant="contained"
          startIcon={<FolderOpenRoundedIcon />}
          onClick={handleOpenFolder}
          sx={{
            bgcolor: tokens.accent,
            color: "#fff",

            px: 2,

            "&:hover": {
              bgcolor: tokens.accentBright,
            },
          }}
        >
          Open Folder
        </Button>
      </Stack>
    </Box>
  );
}
return (
  <Box
    sx={{
      height: "100vh",
      width: "100vw",

      display: "flex",
      flexDirection: "column",

      overflow: "hidden",

      bgcolor: tokens.bg,
      color: tokens.text,
    }}
  >
    {/* Main IDE */}
    <Box
      sx={{
        flex: 1,
        minHeight: 0,

        display: "flex",
      }}
    >
      {/* Activity Bar */}
      <ActivityBar
        onOpenFolder={handleOpenFolder}
      />

      {/* Explorer */}
      <Box
        sx={{
          width: 245,
          flexShrink: 0,
          minHeight: 0,

          borderRight:
            `1px solid ${tokens.border}`,

          overflowY: "auto",
        }}
      >
        <FileTree
          key={treeVersion}
          activePath={activePath}
          onFileClick={openFile}
        />
      </Box>

      {/* Editor */}
      <EditorPane
        tabs={tabs}
        activePath={activePath}
        onSelectTab={setActivePath}
        onCloseTab={closeTab}
        onContentChange={updateContent}
        onSave={saveFile}
      />

      {/* AI */}
      <ChatPanel
        projectOpen={Boolean(projectRoot)}
        activePath={activePath}
        openPaths={tabs.map((t) => t.path)}
      />
    </Box>

    {/* Status Bar */}
    <Box
      sx={{
        height: 22,
        flexShrink: 0,

        display: "flex",
        alignItems: "center",

        px: 1,

        bgcolor: "#007acc",
        color: "#fff",

        fontSize: 11,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
        }}
      >
        <Typography
          sx={{
            fontSize: 11,
            color: "#fff",
          }}
        >
          main
        </Typography>

        <Typography
          sx={{
            fontSize: 11,
            color: "#fff",
          }}
        >
          ✓ 0
        </Typography>
      </Stack>

      <Box sx={{ flex: 1 }} />

      <Stack
        direction="row"
        spacing={1.5}
      >
        <Typography
          sx={{
            fontSize: 11,
            color: "#fff",
          }}
        >
          TypeScript
        </Typography>

        <Typography
          sx={{
            fontSize: 11,
            color: "#fff",
          }}
        >
          UTF-8
        </Typography>

        <Typography
          sx={{
            fontSize: 11,
            color: "#fff",
          }}
        >
          LF
        </Typography>

        <Typography
          sx={{
            fontSize: 11,
            color: "#fff",
          }}
        >
          Spaces: 2
        </Typography>
      </Stack>
    </Box>

    <Snackbar
      open={notice !== null}
      autoHideDuration={4000}
      onClose={() => setNotice(null)}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "center",
      }}
    >
      {notice ? (
        <Alert
          severity={notice.severity}
          variant="filled"
          onClose={() => setNotice(null)}
        >
          {notice.message}
        </Alert>
      ) : undefined}
    </Snackbar>
    {pendingChanges[0] && (
        <PendingChangeDialog
          change={pendingChanges[0]}
          queuedCount={pendingChanges.length - 1}
          onRespond={respondToPendingChange}
        />
    )}
  </Box>
);
}