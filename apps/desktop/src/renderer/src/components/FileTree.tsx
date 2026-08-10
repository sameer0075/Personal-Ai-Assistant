// import { useState } from "react";
// import Box from "@mui/material/Box";
// import Stack from "@mui/material/Stack";
// import Typography from "@mui/material/Typography";
// import CircularProgress from "@mui/material/CircularProgress";
// import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
// import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
// import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
// import { tokens } from "../theme/theme";

// interface DirectoryEntry {
//   name: string;
//   type: "file" | "directory";
// }

// interface FileTreeNodeProps {
//   path: string; // relative to project root
//   name: string;
//   type: "file" | "directory";
//   depth: number;
//   activePath: string | null;
//   onFileClick: (path: string) => void;
// }

// function FileTreeNode({ path, name, type, depth, activePath, onFileClick }: FileTreeNodeProps) {
//   const [expanded, setExpanded] = useState(false);
//   const [children, setChildren] = useState<DirectoryEntry[] | null>(null);
//   const [isLoading, setIsLoading] = useState(false);

//   async function handleToggle() {
//     if (type === "file") {
//       onFileClick(path);
//       return;
//     }

//     if (!expanded && children === null) {
//       setIsLoading(true);
//       try {
//         setChildren(await window.api.readDirectory(path));
//       } finally {
//         setIsLoading(false);
//       }
//     }
//     setExpanded((v) => !v);
//   }

//   const isActive = type === "file" && path === activePath;

//   return (
//     <Box>
//       <Stack
//         direction="row"
//         onClick={handleToggle}
//         sx={{
//           alignItems: "center",
//           gap: 0.5,
//           pl: depth * 1.5 + 0.5,
//           py: 0.4,
//           cursor: "pointer",
//           borderRadius: 1,
//           bgcolor: isActive ? tokens.accentDim : "transparent",
//           "&:hover": { bgcolor: isActive ? tokens.accentDim : tokens.panelRaised },
//         }}
//       >
//         {type === "directory" ? (
//           <ChevronRightRoundedIcon
//             sx={{ fontSize: 16, color: tokens.mutedDim, transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}
//           />
//         ) : (
//           <Box sx={{ width: 16 }} />
//         )}
//         {type === "directory" ? (
//           <FolderRoundedIcon sx={{ fontSize: 15, color: tokens.accentBright }} />
//         ) : (
//           <InsertDriveFileOutlinedIcon sx={{ fontSize: 14, color: tokens.muted }} />
//         )}
//         <Typography sx={{ fontSize: 12.5, color: isActive ? tokens.text : tokens.muted }}>{name}</Typography>
//         {isLoading && <CircularProgress size={10} sx={{ ml: 0.5 }} />}
//       </Stack>

//       {expanded && children && (
//         <Box>
//           {children.map((child) => (
//             <FileTreeNode
//               key={child.name}
//               path={`${path === "." ? "" : path + "/"}${child.name}`}
//               name={child.name}
//               type={child.type}
//               depth={depth + 1}
//               activePath={activePath}
//               onFileClick={onFileClick}
//             />
//           ))}
//         </Box>
//       )}
//     </Box>
//   );
// }

// export default function FileTree({ activePath, onFileClick }: { activePath: string | null; onFileClick: (path: string) => void }) {
//   return (
//     <Box sx={{ py: 1 }}>
//       <FileTreeNode path="." name="." type="directory" depth={0} activePath={activePath} onFileClick={onFileClick} />
//     </Box>
//   );
// }

import { useState } from "react";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

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

function getFileColor(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "ts":
    case "tsx":
      return "#3178c6";

    case "js":
    case "jsx":
      return "#f7df1e";

    case "json":
      return "#cbcb41";

    case "css":
    case "scss":
      return "#42a5f5";

    case "html":
      return "#e44d26";

    case "md":
      return "#519aba";

    case "py":
      return "#3776ab";

    default:
      return tokens.muted;
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
          <InsertDriveFileOutlinedIcon
            sx={{
              fontSize: 15,
              color: getFileColor(name),
            }}
          />
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