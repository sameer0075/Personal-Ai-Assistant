"use client";

import { useCallback, useEffect, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import InputAdornment from "@mui/material/InputAdornment";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import { tokens } from "@/lib/theme";
import { GithubLogo, BrandTile } from "./BrandLogo";
import IntegrationCard, { panelCardSx } from "./IntegrationCard";
import { connectGithub, disconnectGithub, getGithubStatus, GithubStatus, syncGithub } from "@/lib/api/github";

export default function GithubCard({ onConnectedChange }: { onConnectedChange?: (connected: boolean) => void }) {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus(await getGithubStatus());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    onConnectedChange?.(status?.connected ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  async function handleConnect() {
    if (!token.trim()) return;
    setIsWorking(true);
    setError(null);
    try {
      setStatus(await connectGithub(token.trim()));
      setToken("");
      setSyncNote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect GitHub.");
    } finally {
      setIsWorking(false);
    }
  }

  async function handleDisconnect() {
    setIsWorking(true);
    setError(null);
    try {
      await disconnectGithub();
      setSyncNote(null);
      await refresh();
    } finally {
      setIsWorking(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      const summary = await syncGithub();
      setSyncNote(
        `Found ${summary.found} open issues across ${summary.repos} repos — indexed ${summary.ingested} new, skipped ${summary.skipped} already-known.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync to search");
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <IntegrationCard
      name="GitHub"
      tagline="Read and draft issues so the assistant can work your backlog."
      tile={
        <BrandTile bg="#24292f">
          <GithubLogo />
        </BrandTile>
      }
      connected={status?.connected ?? false}
      statusLabel={status?.login ?? null}
      loading={isLoading}
      working={isWorking}
      onDisconnect={handleDisconnect}
      connectLabel="Connect GitHub"
      cta={
        <Stack spacing={1.25}>
          <TextField
            fullWidth
            type="password"
            placeholder="Paste your GitHub personal access token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            slotProps={{
              htmlInput: { autoComplete: "off", spellCheck: false },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <KeyRoundedIcon sx={{ fontSize: 16, color: tokens.mutedDim }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: tokens.bg,
                "& fieldset": { borderColor: tokens.border },
              },
            }}
          />
          <Typography variant="caption" sx={{ color: tokens.mutedDim }}>
            Create one at <b>github.com/settings/tokens</b> — fine-grained, grant <b>Contents</b> (read),{" "}
            <b>Issues</b> (read/write), and <b>Pull requests</b> (read) for the repos you use.
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
          <Button
            fullWidth
            size="small"
            startIcon={isWorking ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <KeyRoundedIcon sx={{ fontSize: 15 }} />}
            disabled={isWorking || token.trim().length < 20}
            onClick={handleConnect}
            sx={{
              background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
              color: "#fff",
              "&:hover": {
                background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                boxShadow: `0 0 0 4px ${tokens.accentGlow}`,
              },
            }}
          >
            Connect GitHub
          </Button>
        </Stack>
      }
      body={
        <Stack spacing={1.5} sx={panelCardSx}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <Typography variant="body2" sx={{ color: tokens.muted, fontSize: 13 }}>
              Index your open issues so the agent can search them like your emails and events.
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={isSyncing ? <CircularProgress size={14} /> : <SyncRoundedIcon sx={{ fontSize: 15 }} />}
              disabled={isSyncing}
              onClick={handleSync}
              sx={{ borderColor: tokens.border, color: tokens.text }}
            >
              Sync now
            </Button>
          </Stack>
          <Typography variant="caption" sx={{ color: tokens.mutedDim }}>
            Latest 10 repos, open issues only.
          </Typography>
          {syncNote && <Alert severity="success" sx={{ p: 1, fontSize: 12.5 }}>{syncNote}</Alert>}
          {error && <Alert severity="error" sx={{ p: 1, fontSize: 12.5 }}>{error}</Alert>}
        </Stack>
      }
    />
  );
}