"use client";

import { useRef, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import { tokens } from "@/lib/theme";

export const RESUME_ACCEPT = ".pdf,.docx,.txt";

const BLOCK_TAGS = new Set(["P", "DIV", "SECTION", "ARTICLE", "UL", "OL", "LI", "TR", "TABLE", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"]);

/**
 * Rich text copied from a web page or doc (headings, paragraphs, lists) loses
 * its line breaks when the browser pastes it into a textarea. Rebuild them:
 * block elements become new lines, headings get a blank line before them, and
 * list items become "• " bullets.
 */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  let out = "";
  const newline = (count: number) => {
    const trailing = out.match(/\n*$/)?.[0].length ?? 0;
    if (out && trailing < count) out += "\n".repeat(count - trailing);
  };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? "").replace(/\s+/g, " ");
      return;
    }
    if (!(node instanceof HTMLElement) || ["SCRIPT", "STYLE"].includes(node.tagName)) return;
    const tag = node.tagName;
    if (tag === "BR") { out += "\n"; return; }
    const isBlock = BLOCK_TAGS.has(tag);
    if (/^H[1-6]$/.test(tag)) newline(2);
    else if (isBlock) newline(1);
    if (tag === "LI") out += "• ";
    node.childNodes.forEach(walk);
    if (/^H[1-6]$/.test(tag)) newline(1);
    else if (tag === "P" || tag === "UL" || tag === "OL") newline(2);
    else if (isBlock) newline(1);
  };
  doc.body.childNodes.forEach(walk);
  return out.split("\n").map((line) => line.trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** onPaste for multiline fields: keeps the structure of rich-text pastes. */
export function pasteKeepingLines(setValue: (update: (current: string) => string) => void) {
  return (event: React.ClipboardEvent<HTMLDivElement>) => {
    const html = event.clipboardData.getData("text/html");
    const target = event.target as HTMLTextAreaElement;
    if (!html || typeof target.selectionStart !== "number") return;
    const text = htmlToPlainText(html);
    if (!text) return;
    event.preventDefault();
    const { selectionStart: start, selectionEnd: end } = target;
    setValue((current) => current.slice(0, start) + text + current.slice(end));
  };
}

/** "" from a text field means "no value" for the API. */
export const orNull = (value: string): string | null => (value.trim() ? value.trim() : null);

export function Toolbar({ search, onSearch, placeholder, actionLabel, onAction, children }: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  actionLabel: string;
  onAction: () => void;
  children?: ReactNode;
}) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ alignItems: { sm: "center" } }}>
      <TextField
        size="small"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        sx={{ flex: 1, bgcolor: tokens.bg, "& fieldset": { borderRadius: 999 } }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18, color: tokens.mutedDim }} /></InputAdornment> } }}
      />
      {children}
      <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={onAction} sx={{ flexShrink: 0 }}>{actionLabel}</Button>
    </Stack>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <Box sx={{ textAlign: "center", py: 5, px: 2, border: `1px dashed ${tokens.border}`, borderRadius: 2 }}>
      <Box sx={{ color: tokens.mutedDim, "& svg": { fontSize: 34 } }}>{icon}</Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text, mt: 1 }}>{title}</Typography>
      <Typography sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.5, maxWidth: 420, mx: "auto" }}>{hint}</Typography>
    </Box>
  );
}

export function RecordRow({ leading, title, subtitle, meta, actions, onClick }: {
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Stack
      direction="row"
      onClick={onClick}
      sx={{
        alignItems: "center",
        gap: 1.5,
        border: `1px solid ${tokens.border}`,
        borderRadius: 2,
        px: 1.75,
        py: 1.25,
        bgcolor: tokens.panel,
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s ease, background-color 0.15s ease",
        "&:hover": onClick ? { borderColor: tokens.borderStrong, bgcolor: tokens.bg } : undefined,
      }}
    >
      {leading}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography component="div" sx={{ fontSize: 13.5, fontWeight: 650, color: tokens.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Typography>
        {subtitle && <Typography component="div" sx={{ fontSize: 11.5, color: tokens.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", mt: 0.25 }}>{subtitle}</Typography>}
      </Box>
      {meta && <Stack direction="row" spacing={0.75} sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", flexShrink: 0 }}>{meta}</Stack>}
      {actions && <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>{actions}</Stack>}
    </Stack>
  );
}

const TONES = {
  green: { bg: "#e3f5ec", fg: "#1b7a4b" },
  blue: { bg: "#e6effa", fg: "#2c5f9e" },
  amber: { bg: "#fbf1dd", fg: "#8a5a0b" },
  purple: { bg: "#efe9f9", fg: "#5e3d99" },
  red: { bg: tokens.dangerDim, fg: tokens.danger },
  grey: { bg: tokens.panelRaised, fg: tokens.muted },
} as const;
export type Tone = keyof typeof TONES;

export function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  return <Chip size="small" label={label} sx={{ height: 22, fontSize: 11, fontWeight: 600, bgcolor: TONES[tone].bg, color: TONES[tone].fg }} />;
}

export function FormDialog({ open, title, subtitle, submitLabel, busy, canSubmit, onClose, onSubmit, children, footerStart }: {
  open: boolean;
  title: string;
  subtitle?: string;
  submitLabel: string;
  busy: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
  footerStart?: ReactNode;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <DialogTitle sx={{ pr: 6 }}>
        <Typography component="div" sx={{ fontSize: 17, fontWeight: 700, color: tokens.text }}>{title}</Typography>
        {subtitle && <Typography component="div" sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.25 }}>{subtitle}</Typography>}
        <IconButton onClick={onClose} disabled={busy} aria-label="Close" sx={{ position: "absolute", right: 12, top: 12 }}><CloseRoundedIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: tokens.border }}>
        <Box
          component="form"
          id="hr-form-dialog"
          onSubmit={(e) => { e.preventDefault(); if (canSubmit && !busy) onSubmit(); }}
          sx={{ display: "grid", gap: 1.75, gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, pt: 0.5, "& .MuiInputBase-multiline": { borderRadius: "14px" } }}
        >
          {children}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.75 }}>
        <Box sx={{ flex: 1 }}>{footerStart}</Box>
        <Button onClick={onClose} disabled={busy} sx={{ color: tokens.muted }}>Cancel</Button>
        <Button type="submit" form="hr-form-dialog" variant="contained" disabled={busy || !canSubmit} startIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/** Full-width grid cell inside FormDialog. */
export const full = { gridColumn: "1 / -1" };

/**
 * CV picker used in the person/applicant dialogs: shows the stored CV (with an
 * open link) and lets the user pick a replacement that's uploaded on save.
 */
export function ResumeField({ currentName, onOpenCurrent, pending, onPick }: {
  currentName: string | null;
  onOpenCurrent?: () => void;
  pending: File | null;
  onPick: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = pending?.name ?? currentName;
  return (
    <Box sx={{ ...full, border: `1px dashed ${tokens.borderStrong}`, borderRadius: 2, p: 1.5, bgcolor: tokens.bg }}>
      <input ref={inputRef} hidden type="file" accept={RESUME_ACCEPT} onChange={(e) => { onPick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
      <Stack direction="row" sx={{ alignItems: "center", gap: 1.25 }}>
        <DescriptionRoundedIcon sx={{ color: shown ? tokens.accent : tokens.mutedDim }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {shown ?? "No CV attached"}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: tokens.muted }}>
            {pending ? "Will be uploaded and indexed when you save" : currentName ? "Searchable by the HR assistant" : "PDF, DOCX, or TXT up to 15 MB"}
          </Typography>
        </Box>
        {pending && <Tooltip title="Discard"><IconButton size="small" onClick={() => onPick(null)}><CloseRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
        {!pending && currentName && onOpenCurrent && <Tooltip title="Open CV"><IconButton size="small" onClick={onOpenCurrent}><OpenInNewRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>}
        <Button size="small" variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => inputRef.current?.click()}>
          {shown ? "Replace" : "Upload CV"}
        </Button>
      </Stack>
    </Box>
  );
}
