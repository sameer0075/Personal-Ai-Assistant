"use client";

import { useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import { tokens } from "@/lib/theme";
import { syncGithub } from "@/lib/api/github";
import { getGithubStatus } from "@/lib/api/github";

export default function GithubPanel() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(true);

  async function handleSync() {
    setIsSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      const summary = await syncGithub();
      setSyncNote(`Found ${summary.found} open issues across ${summary.repos} repos - indexed ${summary.ingested} new, skipped ${summary.skipped} already-known.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync to search");
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getGithubStatus()
      .then((status) => {
        if (!cancelled) setDisabled(!status.connected);
      })
      .catch(() => {
        if (!cancelled) setDisabled(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.border}`, bgcolor: tokens.panel }}>
      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>GitHub issues → search</Typography>
          <Typography variant="body2" sx={{ color: tokens.muted }}>
            Index your open issues so the agent can search them like your emails and events.
          </Typography>
        </Stack>

        {syncNote && <Alert severity="success">{syncNote}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}

        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={isSyncing ? <CircularProgress size={14} /> : <SyncRoundedIcon sx={{ fontSize: 16 }} />}
            disabled={isSyncing || disabled}
            onClick={handleSync}
            sx={{ borderRadius: 2, borderColor: tokens.border, color: tokens.text }}
          >
            Sync now
          </Button>
          <Typography variant="caption" sx={{ color: tokens.mutedDim }}>
            {disabled ? "Connect GitHub above first." : "Latest 10 repos, open issues only."}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}