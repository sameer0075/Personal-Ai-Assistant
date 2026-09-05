import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { tokens } from "../theme/theme";

interface WorkspaceRoot {
  name: string;
  root: string;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  roots: WorkspaceRoot[];
}

interface Props {
  workspaces: WorkspaceInfo[];
  activeWorkspaceId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onAddWorkspace: () => void;
  /** Adds another repo to the ACTIVE workspace so they share one chat. */
  onAddRepoToActive: (workspaceId: string) => void;
}

// A slim vertical rail of open workspaces, like VS Code's workspace switcher —
// click to make active, hover to reveal a close button, and a "+" on the active
// workspace to add another repo (frontend + backend sharing one chat).
export default function ProjectSwitcher({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  onClose,
  onAddWorkspace,
  onAddRepoToActive,
}: Props) {
  return (
    <Stack sx={{ width: 52, flexShrink: 0, borderRight: `1px solid ${tokens.border}`, py: 1, alignItems: "center", gap: 0.5 }}>
      {workspaces.map((w) => {
        const isActive = w.id === activeWorkspaceId;
        const tooltip = `${w.name}${w.roots.length > 1 ? ` · ${w.roots.length} repos: ${w.roots.map((r) => r.root).join(", ")}` : ` (${w.roots[0].root})`}`;
        return (
          <Tooltip key={w.id} title={tooltip} placement="right">
            <Box
              onClick={() => onSwitch(w.id)}
              sx={{
                position: "relative",
                width: 40,
                height: 40,
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                bgcolor: isActive ? tokens.panelRaised : "transparent",
                border: `1px solid ${isActive ? tokens.accent : "transparent"}`,
                "&:hover": { bgcolor: tokens.panelRaised },
                "&:hover .close-btn": { opacity: 1 },
              }}
            >
              {w.roots.length > 1 ? (
                <GridOnRoundedIcon sx={{ fontSize: 15, color: isActive ? tokens.accentBright : tokens.muted }} />
              ) : (
                <FolderRoundedIcon sx={{ fontSize: 18, color: isActive ? tokens.accentBright : tokens.muted }} />
              )}
              <IconButton
                className="close-btn"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(w.id);
                }}
                sx={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, opacity: 0, bgcolor: tokens.panelRaised, "&:hover": { bgcolor: tokens.border } }}
              >
                <CloseRoundedIcon sx={{ fontSize: 11 }} />
              </IconButton>
            </Box>
          </Tooltip>
        );
      })}

      <Tooltip title="Add repo to active workspace" placement="right">
        <IconButton
          onClick={() => activeWorkspaceId && onAddRepoToActive(activeWorkspaceId)}
          disabled={!activeWorkspaceId}
          sx={{ width: 24, height: 24, color: tokens.muted, "&:hover": { color: tokens.accentBright }, "&.Mui-disabled": { color: tokens.mutedDim } }}
        >
          <AddRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>

      <Tooltip title="New workspace (open folder)" placement="right">
        <IconButton onClick={onAddWorkspace} sx={{ width: 40, height: 40, color: tokens.muted, "&:hover": { color: tokens.accentBright } }}>
          <FolderRoundedIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}