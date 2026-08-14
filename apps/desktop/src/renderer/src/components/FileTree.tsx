import { useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import JavascriptRoundedIcon from "@mui/icons-material/JavascriptRounded";
import DataObjectRoundedIcon from "@mui/icons-material/DataObjectRounded";
import HtmlRoundedIcon from "@mui/icons-material/HtmlRounded";
import CssRoundedIcon from "@mui/icons-material/CssRounded";
import ArticleRoundedIcon from "@mui/icons-material/ArticleRounded";
import TerminalRoundedIcon from "@mui/icons-material/TerminalRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import TableChartRoundedIcon from "@mui/icons-material/TableChartRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import "@vscode/codicons/dist/codicon.css";

import { tokens } from "../theme/theme";

interface DirectoryEntry {
  name: string;
  type: "file" | "directory";
}

interface FileTreeProps {
  activePath: string | null;
  onFileClick: (path: string) => void;
}

interface FileTreeNodeProps {
  path: string;
  name: string;
  type: "file" | "directory";
  depth: number;
  activePath: string | null;
  onFileClick: (path: string) => void;
}

function getFileIcon(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();

  switch (extension) {
    // TypeScript
    case "ts":
      return {
        icon: CodeRoundedIcon,
        color: "#3178c6",
      };

    case "tsx":
      return {
        icon: CodeRoundedIcon,
        color: "#61dafb",
      };

    // JavaScript
    case "js":
      return {
        icon: JavascriptRoundedIcon,
        color: "#f7df1e",
      };

    case "jsx":
      return {
        icon: JavascriptRoundedIcon,
        color: "#61dafb",
      };

    // JSON
    case "json":
      return {
        icon: DataObjectRoundedIcon,
        color: "#cbcb41",
      };

    // HTML
    case "html":
    case "htm":
      return {
        icon: HtmlRoundedIcon,
        color: "#e44d26",
      };

    // CSS
    case "css":
      return {
        icon: CssRoundedIcon,
        color: "#1572b6",
      };

    case "scss":
    case "sass":
      return {
        icon: CssRoundedIcon,
        color: "#cd6799",
      };

    // Markdown / text
    case "md":
    case "mdx":
    case "txt":
      return {
        icon: ArticleRoundedIcon,
        color: "#519aba",
      };

    // Python
    case "py":
      return {
        icon: CodeRoundedIcon,
        color: "#3776ab",
      };

    // Shell
    case "sh":
    case "bash":
    case "zsh":
      return {
        icon: TerminalRoundedIcon,
        color: "#89e051",
      };

    // Images
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return {
        icon: ImageRoundedIcon,
        color: "#a074c4",
      };

    // CSV / Excel
    case "csv":
    case "xlsx":
    case "xls":
      return {
        icon: TableChartRoundedIcon,
        color: "#21a366",
      };

    // Config
    case "env":
    case "yaml":
    case "yml":
    case "toml":
      return {
        icon: SettingsRoundedIcon,
        color: tokens.muted,
      };

    default:
      return {
        icon: InsertDriveFileOutlinedIcon,
        color: tokens.muted,
      };
  }
}

function FileTreeNode({
  path,
  name,
  type,
  depth,
  activePath,
  onFileClick,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] =
    useState<DirectoryEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    if (type === "file") {
      onFileClick(path);
      return;
    }

    if (!expanded && children === null) {
      setIsLoading(true);

      try {
        const result = await window.api.readDirectory(path);
        setChildren(result);
      } finally {
        setIsLoading(false);
      }
    }

    setExpanded((value) => !value);
  }

  const isActive =
    type === "file" && path === activePath;

  return (
    <Box>
      <Stack
        direction="row"
        onClick={handleClick}
        sx={{
          height: 24,
          alignItems: "center",
          gap: 0.5,

          pl: `${depth * 14 + 4}px`,

          cursor: "pointer",

          bgcolor: isActive
            ? tokens.active
            : "transparent",

          color: isActive
            ? tokens.textBright
            : tokens.text,

          "&:hover": {
            bgcolor: tokens.hover,
          },
        }}
      >
        {type === "directory" ? (
          <ChevronRightRoundedIcon
            sx={{
              fontSize: 16,
              color: tokens.muted,
              transform: expanded
                ? "rotate(90deg)"
                : "none",
              transition: "transform 100ms",
            }}
          />
        ) : (
          <Box sx={{ width: 16 }} />
        )}

        {type === "directory" ? (
          <FolderRoundedIcon
            sx={{
              fontSize: 16,
              color: "#dcb67a",
            }}
          />
        ) : (
          (() => {
            const { icon: FileIcon, color } = getFileIcon(name);

            return (
              <FileIcon
                sx={{
                  fontSize: 15,
                  color,
                }}
              />
            );
          })()
        )}

        <Typography
          sx={{
            fontSize: 13,
            lineHeight: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {name}
        </Typography>

        {isLoading && (
          <CircularProgress
            size={10}
            sx={{ ml: 0.5 }}
          />
        )}
      </Stack>

      {expanded && children && (
        <Box>
          {children.map((child) => (
            <FileTreeNode
              key={child.name}
              path={`${path === "." ? "" : `${path}/`}${child.name}`}
              name={child.name}
              type={child.type}
              depth={depth + 1}
              activePath={activePath}
              onFileClick={onFileClick}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function FileTree({
  activePath,
  onFileClick,
}: FileTreeProps) {
  return (
    <Box
      sx={{
        height: "100%",
        bgcolor: tokens.sidebar,
      }}
    >
      <Stack
        direction="row"
        sx={{
          height: 35,
          px: 2,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.5,
            color: tokens.text,
          }}
        >
          EXPLORER
        </Typography>

        <RefreshRoundedIcon
          sx={{
            fontSize: 16,
            color: tokens.muted,
            cursor: "pointer",

            "&:hover": {
              color: tokens.text,
            },
          }}
        />
      </Stack>

      <Box>
        <Typography
          sx={{
            px: 1.5,
            py: 0.5,
            fontSize: 11,
            fontWeight: 600,
            color: tokens.text,
          }}
        >
          PROJECT
        </Typography>

        <FileTreeNode
          path="."
          name="."
          type="directory"
          depth={0}
          activePath={activePath}
          onFileClick={onFileClick}
        />
      </Box>
    </Box>
  );
}