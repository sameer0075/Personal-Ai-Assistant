import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import { DiffEditor } from "@monaco-editor/react";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { tokens } from "../theme/theme";

export interface PendingFileChange {
  id: string;
  tool: "write_file" | "edit_file" | "delete_file" | "create_directory";
  path: string;
  before: string | null;
  after: string | null;
  summary: string;
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  css: "css",
  scss: "scss",
  html: "html",
  md: "markdown",
  py: "python",
  yml: "yaml",
  yaml: "yaml",
};

function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_LANGUAGE_MAP[ext] ?? "plaintext";
}

interface PendingChangeDialogProps {
  change: PendingFileChange;
  queuedCount: number;
  onRespond: (approved: boolean) => void;
}

export default function PendingChangeDialog({ change, queuedCount, onRespond }: PendingChangeDialogProps) {
  const hasDiff = change.tool === "write_file" || change.tool === "edit_file";
  const isDestructive = change.tool === "delete_file";

  return (
    <Dialog
      open
      maxWidth="md"
      fullWidth
      onClose={() => onRespond(false)}
      slotProps={{ paper: { sx: { bgcolor: tokens.editor, border: `1px solid ${tokens.border}` } } }}
    >
      <DialogTitle sx={{ borderBottom: `1px solid ${tokens.border}`, py: 1.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Chip
            size="small"
            label={change.summary}
            sx={{
              bgcolor: isDestructive ? "rgba(241,76,76,0.15)" : tokens.accentDim,
              color: isDestructive ? tokens.danger : tokens.accentBright,
              fontSize: 11,
              height: 22,
            }}
          />
          <Typography sx={{ fontSize: 13, color: tokens.text, fontFamily: "monospace" }}>{change.path}</Typography>
          {queuedCount > 0 && (
            <Typography sx={{ fontSize: 11, color: tokens.mutedDim, ml: "auto !important" }}>
              +{queuedCount} more pending
            </Typography>
          )}
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {hasDiff && change.after !== null ? (
          <Box sx={{ height: 420 }}>
            <DiffEditor
              original={change.before ?? ""}
              modified={change.after}
              language={languageForPath(change.path)}
              theme="vs-dark"
              options={{ fontSize: 13, readOnly: true, renderSideBySide: true, minimap: { enabled: false } }}
            />
          </Box>
        ) : (
          <Box sx={{ p: 3 }}>
            <Typography sx={{ fontSize: 13, color: isDestructive ? tokens.danger : tokens.text }}>
              {isDestructive
                ? `This permanently deletes "${change.path}". This cannot be undone.`
                : `This creates the directory "${change.path}".`}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: `1px solid ${tokens.border}`, p: 1.5 }}>
        <Button
          onClick={() => onRespond(false)}
          startIcon={<CloseRoundedIcon />}
          sx={{ color: tokens.muted, "&:hover": { bgcolor: tokens.hover } }}
        >
          Reject
        </Button>
        <Button
          onClick={() => onRespond(true)}
          variant="contained"
          startIcon={<CheckRoundedIcon />}
          sx={{
            bgcolor: isDestructive ? tokens.danger : tokens.accent,
            "&:hover": { bgcolor: isDestructive ? tokens.danger : tokens.accentBright },
          }}
        >
          {isDestructive ? "Delete" : "Approve"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}