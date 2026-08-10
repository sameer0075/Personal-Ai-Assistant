import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import SourceOutlinedIcon from "@mui/icons-material/SourceOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";

import { tokens } from "../theme/theme";

interface ActivityBarProps {
  onOpenFolder: () => void;
}

export default function ActivityBar({
  onOpenFolder,
}: ActivityBarProps) {
  return (
    <Box
      sx={{
        width: 48,
        flexShrink: 0,
        height: "100%",
        bgcolor: tokens.activityBar,
        borderRight: `1px solid ${tokens.border}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 0.5,
      }}
    >
      <ActivityButton
        title="Explorer"
        icon={<FolderOutlinedIcon />}
        active
      />

      <ActivityButton
        title="Search"
        icon={<SearchOutlinedIcon />}
      />

      <ActivityButton
        title="Source Control"
        icon={<SourceOutlinedIcon />}
      />

      <ActivityButton
        title="Extensions"
        icon={<ExtensionOutlinedIcon />}
      />

      <Box sx={{ flex: 1 }} />

      <ActivityButton
        title="AI Assistant"
        icon={<SmartToyOutlinedIcon />}
      />

      <ActivityButton
        title="Settings"
        icon={<SettingsOutlinedIcon />}
        onClick={onOpenFolder}
      />
    </Box>
  );
}

function ActivityButton({
  title,
  icon,
  active,
  onClick,
}: {
  title: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip title={title} placement="right">
      <IconButton
        onClick={onClick}
        sx={{
          width: 48,
          height: 48,
          color: active ? tokens.textBright : tokens.muted,
          position: "relative",

          "&:hover": {
            color: tokens.textBright,
            bgcolor: "transparent",
          },

          ...(active && {
            "&::before": {
              content: '""',
              position: "absolute",
              left: 0,
              top: 8,
              bottom: 8,
              width: 2,
              bgcolor: tokens.textBright,
            },
          }),

          "& svg": {
            fontSize: 24,
          },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}