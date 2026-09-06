"use client";

import { useCallback, useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Alert from "@mui/material/Alert";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import { tokens } from "@/lib/theme";
import { connectGithub, disconnectGithub, getGithubStatus, GithubStatus } from "@/lib/api/github";

export default function GithubConnectCard() {
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  async function handleConnect() {
    if (!token.trim()) return;
    setIsWorking(true);
    setError(null);
    try {
      setStatus(await connectGithub(token.trim()));
      setToken("");
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
      await refresh();
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.border}`, bgcolor: tokens.panel }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <Stack spacing={0.5}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>GitHub account</Typography>

            {isLoading ? (
              <CircularProgress size={16} sx={{ color: tokens.mutedDim }} />
            ) : status?.connected ? (
              <Chip
                icon={<CheckCircleRoundedIcon sx={{ fontSize: 15 }} />}
                label={status.login ?? "Connected"}
                size="small"
                sx={{
                  bgcolor: tokens.accentDim,
                  border: `1px solid ${tokens.userBorder}`,
                  color: tokens.accentBright,
                  width: "fit-content",
                }}
              />
            ) : (
              <Typography variant="body2" sx={{ color: tokens.muted }}>
                Not connected — reading repos/issues only works after connecting.
              </Typography>
            )}
          </Stack>

          {status?.connected && (
            <Button
              size="small"
              variant="outlined"
              startIcon={isWorking ? <CircularProgress size={14} /> : <LinkOffRoundedIcon sx={{ fontSize: 16 }} />}
              disabled={isLoading || isWorking}
              onClick={handleDisconnect}
              sx={{
                borderColor: tokens.danger,
                color: tokens.danger,
                borderRadius: 2,
                "&:hover": { borderColor: tokens.danger, bgcolor: tokens.dangerDim },
              }}
            >
              Disconnect
            </Button>
          )}
        </Stack>

        {!status?.connected && (
          <>
            <TextField
              fullWidth
              size="small"
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
            <Typography variant="caption" sx={{ color: tokens.mutedDim, mt: -1 }}>
              Create one at <b>github.com/settings/tokens</b> — fine-grained, grant <b>Contents</b> (read),{" "}
              <b>Issues</b> (read/write), and <b>Pull requests</b> (read) for the repos you use.
            </Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <Button
              fullWidth
              startIcon={isWorking ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <LinkRoundedIcon sx={{ fontSize: 16 }} />}
              disabled={isWorking || token.trim().length < 20}
              onClick={handleConnect}
              sx={{
                borderRadius: 2,
                color: "#fff",
                background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                "&:hover": {
                  background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                  boxShadow: `0 0 0 4px ${tokens.accentGlow}`,
                },
                "&.Mui-disabled": { background: tokens.panelRaised, color: tokens.mutedDim },
              }}
            >
              Connect GitHub
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  );
}