"use client";

import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import { tokens } from "@/lib/theme";
import {
  approveAction,
  rejectAction,
  EmailActionPayload,
  GithubCommentActionPayload,
  GithubIssueActionPayload,
  LinkedinActionPayload,
  PendingAction,
} from "@/lib/api/actions";

interface ActionApprovalModalProps {
  action: PendingAction | null;
  open: boolean;
  onClose: () => void;
  onDecided: (action: PendingAction) => void;
}

// Shared dark-theme overrides so MUI's default light Dialog/TextField chrome
// matches the rest of the app (tokens.* is used everywhere else via sx, but
// Dialog/TextField pull from the MUI theme palette by default, which isn't
// dark here - so every field needs these overrides explicitly).
const fieldSx = {
  "& .MuiOutlinedInput-root": {
    color: tokens.text,
    bgcolor: tokens.panelRaised,
    borderRadius: 2,

    "& fieldset": {
      borderColor: tokens.border,
    },

    "&:hover fieldset": {
      borderColor: tokens.accentDim,
    },

    "&.Mui-focused fieldset": {
      borderColor: tokens.accent,
      borderWidth: "1px",
    },
  },

  "& .MuiInputLabel-root": {
    color: tokens.muted,
  },

  "& .MuiInputLabel-root.Mui-focused": {
    color: tokens.accentBright,
  },

  "& .MuiFormHelperText-root": {
    color: tokens.mutedDim,
    marginLeft: 0,
  },
};

export default function ActionApprovalModal({ action, open, onClose, onDecided }: ActionApprovalModalProps) {
  const isEmail = action?.type === "email";
  const isLinkedin = action?.type === "linkedin_post";
  const isGithubIssue = action?.type === "github_issue";
  const isGithubComment = action?.type === "github_comment";

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachCv, setAttachCv] = useState(false);
  const [commentary, setCommentary] = useState("");
  const [repo, setRepo] = useState("");
  const [title, setTitle] = useState("");
  const [issueNumber, setIssueNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!action) return;
    setError(null);
    setIsSubmitting(null);
    switch (action.type) {
      case "email": {
        const p = action.payload as EmailActionPayload;
        setTo(p.to);
        setCc(p.cc ?? "");
        setSubject(p.subject);
        setBody(p.body);
        setAttachCv(Boolean(p.attachCv));
        break;
      }
      case "linkedin_post":
        setCommentary((action.payload as LinkedinActionPayload).commentary);
        break;
      case "github_issue": {
        const p = action.payload as GithubIssueActionPayload;
        setRepo(p.repo);
        setTitle(p.title);
        setBody(p.body);
        break;
      }
      case "github_comment": {
        const p = action.payload as GithubCommentActionPayload;
        setRepo(p.repo);
        setIssueNumber(String(p.issueNumber));
        setBody(p.body);
        break;
      }
    }
  }, [action]);

  if (!action) return null;

  async function handleApprove() {
    setIsSubmitting("approve");
    setError(null);
    try {
      let edits: Partial<Record<string, unknown>>;
      if (isEmail) {
        edits = { to, subject, body, cc: cc || undefined, attachCv };
      } else if (isLinkedin) {
        edits = { commentary };
      } else if (isGithubIssue) {
        edits = { repo, title, body };
      } else {
        edits = { repo, issueNumber: Number(issueNumber), body };
      }
      const updated = await approveAction(action!.id, edits as never);
      onDecided(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute draft");
      setIsSubmitting(null);
    }
  }

  async function handleReject() {
    setIsSubmitting("reject");
    setError(null);
    try {
      const updated = await rejectAction(action!.id);
      onDecided(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discard draft");
      setIsSubmitting(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={isSubmitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: { bgcolor: tokens.panel, border: `1px solid ${tokens.border}`, backgroundImage: "none" },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: tokens.text }}>
        {isEmail
          ? "Review email before sending"
          : isLinkedin
            ? "Review LinkedIn post before publishing"
            : isGithubIssue
              ? "Review GitHub issue before opening"
              : "Review comment before posting"}
        <Chip
          size="small"
          label={action.createdBy === "agent" ? "Drafted by assistant" : "Your draft"}
          sx={{
            ml: "auto",
            fontSize: 11,
            bgcolor: tokens.panelRaised,
            border: `1px solid ${tokens.border}`,
            color: tokens.muted,
          }}
        />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            Nothing has been{" "}
            {isEmail ? "sent" : isLinkedin ? "published" : isGithubIssue ? "created" : "posted"} yet. Make any
            changes you need below, then approve to {isEmail ? "send it" : isLinkedin ? "publish it" : isGithubIssue ? "create it" : "post it"} - or
            reject to discard the draft.
          </Typography>

          {isEmail ? (
            <>
              <TextField
                label="To"
                type="email"
                size="small"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                sx={fieldSx}
              />
              <TextField
                label="Cc (optional)"
                type="email"
                size="small"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                sx={fieldSx}
              />
              <TextField
                label="Subject"
                size="small"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                sx={fieldSx}
              />
              <TextField
                label="Body"
                size="small"
                required
                multiline
                minRows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                sx={fieldSx}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={attachCv}
                    onChange={(e) => setAttachCv(e.target.checked)}
                    size="small"
                    sx={{ color: tokens.muted, "&.Mui-checked": { color: tokens.accentBright } }}
                  />
                }
                label="Attach CV"
                sx={{ color: tokens.text }}
              />
            </>
          ) : isLinkedin ? (
            <TextField
              label="Post text"
              size="small"
              required
              multiline
              minRows={6}
              value={commentary}
              onChange={(e) => e.target.value.length <= 3000 && setCommentary(e.target.value)}
              helperText={`${commentary.length}/3000 - this will be visible to your LinkedIn network`}
              sx={fieldSx}
            />
          ) : (
            <>
              <TextField
                label="Repository"
                size="small"
                required
                placeholder="owner/repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                helperText="Format: owner/repo"
                sx={fieldSx}
              />
              {isGithubIssue ? (
                <TextField
                  label="Issue title"
                  size="small"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  sx={fieldSx}
                />
              ) : (
                <TextField
                  label="Issue / PR number"
                  size="small"
                  required
                  type="number"
                  value={issueNumber}
                  onChange={(e) => setIssueNumber(e.target.value)}
                  sx={fieldSx}
                />
              )}
              <TextField
                label={isGithubIssue ? "Issue body" : "Comment text"}
                size="small"
                required
                multiline
                minRows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                sx={fieldSx}
              />
            </>
          )}

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={isSubmitting !== null} sx={{ color: tokens.muted }}>
          Close
        </Button>
        <Button
          onClick={handleReject}
          disabled={isSubmitting !== null}
          startIcon={isSubmitting === "reject" ? <CircularProgress size={14} /> : undefined}
          sx={{ color: tokens.danger }}
        >
          Reject
        </Button>
        <Button
          variant="contained"
          onClick={handleApprove}
          disabled={
            isSubmitting !== null ||
            (isEmail
              ? !to || !subject || !body
              : isLinkedin
                ? !commentary.trim()
                : isGithubIssue
                  ? !repo || !title || !body
                  : !repo || !issueNumber || !body)
          }
          startIcon={isSubmitting === "approve" ? <CircularProgress size={14} color="inherit" /> : undefined}
          sx={{
            background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
            "&:hover": { background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})` },
          }}
        >
          {isEmail ? "Approve & send" : isLinkedin ? "Approve & publish" : isGithubIssue ? "Approve & open issue" : "Approve & post comment"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}