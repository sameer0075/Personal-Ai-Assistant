import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import { tokens } from "../theme/theme";

interface ProjectInfo {
  id: string;
  root: string;
  name: string;
}

interface Props {
  projects: ProjectInfo[];
  activeProjectId: string;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onAddFolder: () => void;
}

// A slim vertical rail of open project folders, like VS Code's workspace
// switcher — click to make active, hover to reveal a close button.
export default function ProjectSwitcher({ projects, activeProjectId, onSwitch, onClose, onAddFolder }: Props) {
  return (
    <Stack sx={{ width: 52, flexShrink: 0, borderRight: `1px solid ${tokens.border}`, py: 1, alignItems: "center", gap: 0.5 }}>
      {projects.map((p) => {
        const isActive = p.id === activeProjectId;
        return (
          <Tooltip key={p.id} title={p.root} placement="right">
            <Box
              onClick={() => onSwitch(p.id)}
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
              <FolderRoundedIcon sx={{ fontSize: 18, color: isActive ? tokens.accentBright : tokens.muted }} />
              <IconButton
                className="close-btn"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(p.id);
                }}
                sx={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, opacity: 0, bgcolor: tokens.panelRaised, "&:hover": { bgcolor: tokens.border } }}
              >
                <CloseRoundedIcon sx={{ fontSize: 11 }} />
              </IconButton>
            </Box>
          </Tooltip>
        );
      })}

      <Tooltip title="Add folder" placement="right">
        <IconButton onClick={onAddFolder} sx={{ width: 40, height: 40, color: tokens.muted, "&:hover": { color: tokens.accentBright } }}>
          <AddRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}