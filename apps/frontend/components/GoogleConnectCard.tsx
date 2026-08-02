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
import { disconnectGoogle, getGoogleAuthUrl, getGoogleStatus, GoogleStatus } from "@/lib/api/google";

export default function GoogleConnectCard() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus(await getGoogleStatus());
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
      const { url } = await getGoogleAuthUrl();
      window.location.href = url; // full redirect - this leaves the SPA, which is correct for OAuth
    } catch {
      setIsWorking(false);
    }
  }

  async function handleDisconnect() {
    setIsWorking(true);
    try {
      await disconnectGoogle();
      await refresh();
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderColor: tokens.border }}>
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}
      >
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-mono)" }}>
            Google account
          </Typography>

          {isLoading ? (
            <CircularProgress size={16} />
          ) : status?.connected ? (
            <Chip
              icon={<CheckCircleRoundedIcon sx={{ fontSize: 15 }} />}
              label={status.googleEmail ?? "Connected"}
              size="small"
              variant="outlined"
              sx={{ borderColor: tokens.accentDim, color: "primary.main", width: "fit-content" }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not connected — Gmail and Calendar tools are unavailable until you connect.
            </Typography>
          )}
        </Stack>

        <Button
          size="small"
          variant={status?.connected ? "outlined" : "contained"}
          color={status?.connected ? "error" : "primary"}
          startIcon={
            isWorking ? (
              <CircularProgress size={14} />
            ) : status?.connected ? (
              <LinkOffRoundedIcon />
            ) : (
              <LinkRoundedIcon />
            )
          }
          disabled={isLoading || isWorking}
          onClick={status?.connected ? handleDisconnect : handleConnect}
        >
          {status?.connected ? "Disconnect" : "Connect Google"}
        </Button>
      </Stack>
    </Paper>
  );
}