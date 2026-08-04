"use client";

import { useCallback, useEffect, useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import { tokens } from "@/lib/theme";
import { disconnectLinkedin, getLinkedinAuthUrl, getLinkedinStatus, LinkedinStatus } from "@/lib/api/linkedin-auth";

export default function LinkedInConnectCard() {
  const [status, setStatus] = useState<LinkedinStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus(await getLinkedinStatus());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleConnect() {
    setIsWorking(true);
    try {
      const { url } = await getLinkedinAuthUrl();
      window.location.href = url; // full redirect - correct for OAuth
    } catch {
      setIsWorking(false);
    }
  }

  async function handleDisconnect() {
    setIsWorking(true);
    try {
      await disconnectLinkedin();
      await refresh();
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.border}`, bgcolor: tokens.panel }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <Stack spacing={0.5}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>LinkedIn account</Typography>

          {isLoading ? (
            <CircularProgress size={16} sx={{ color: tokens.mutedDim }} />
          ) : status?.connected ? (
            <Chip
              icon={<CheckCircleRoundedIcon sx={{ fontSize: 15 }} />}
              label={status.personUrn ?? "Connected"}
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
              Not connected — posting is unavailable until you connect.
            </Typography>
          )}
        </Stack>

        {status?.connected ? (
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
        ) : (
          <Button
            size="small"
            startIcon={isWorking ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <LinkRoundedIcon sx={{ fontSize: 16 }} />}
            disabled={isLoading || isWorking}
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
            Connect LinkedIn
          </Button>
        )}
      </Stack>
    </Paper>
  );
}