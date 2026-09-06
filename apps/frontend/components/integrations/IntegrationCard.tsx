import { ReactNode } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import LinkRoundedIcon from "@mui/icons-material/LinkRounded";
import LinkOffRoundedIcon from "@mui/icons-material/LinkOffRounded";
import { tokens } from "@/lib/theme";

interface IntegrationCardProps {
  /** Short service name, e.g. "Google" */
  name: string;
  /** One-line description shown under the name. */
  tagline: string;
  /** Rounded brand tile rendered on the left. */
  tile: ReactNode;
  /** True when the account is connected. */
  connected: boolean;
  /** Account identity shown in the status pill, e.g. email or handle. */
  statusLabel?: string | null;
  /** Loading the connection status. */
  loading: boolean;
  /** Connect / disconnect request in flight. */
  working: boolean;
  /** Connect / disconnect handlers. Omit onConnect to hard-disable connecting. */
  onConnect?: () => void;
  onDisconnect?: () => void;
  /** Label for the primary connect button, e.g. "Connect Google". */
  connectLabel: string;
  /** Body rendered (collapsed) only while connected. */
  body?: ReactNode | null;
  /** Region shown below the header while NOT connected (e.g. a token form). */
  cta?: ReactNode | null;
}

const panelCardSx = { bgcolor: `${tokens.accent}0f`, border: `1px solid ${tokens.accentDim}`, borderRadius: 2.5 };

function StatusPill({ connected, statusLabel, loading }: { connected: boolean; statusLabel?: string | null; loading: boolean }) {
  if (loading) {
    return (
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", height: 22 }}>
        <CircularProgress size={12} sx={{ color: tokens.mutedDim }} />
        <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>checking</Typography>
      </Stack>
    );
  }
  return connected ? (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: "center", px: 1, py: 0.35, borderRadius: 99, bgcolor: tokens.accentDim, width: "fit-content" }}
    >
      <CheckCircleRoundedIcon sx={{ fontSize: 13, color: "primary.main" }} />
      <Typography sx={{ fontSize: 11.5, color: "primary.main", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
        {statusLabel ?? "Connected"}
      </Typography>
    </Stack>
  ) : (
    <Stack
      direction="row"
      spacing={0.75}
      sx={{ alignItems: "center", px: 1, py: 0.35, borderRadius: 99, bgcolor: tokens.panelRaised, width: "fit-content" }}
    >
      <BoxDot sx={{ bgcolor: tokens.mutedDim }} />
      <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)", fontWeight: 500 }}>
        Not connected
      </Typography>
    </Stack>
  );
}

function BoxDot({ sx }: { sx: Record<string, string> }) {
  return <span style={{ width: 7, height: 7, borderRadius: 99, display: "inline-block", flexShrink: 0, ...sx }} />;
}

export default function IntegrationCard({
  name,
  tagline,
  tile,
  connected,
  statusLabel,
  loading,
  working,
  onConnect,
  onDisconnect,
  connectLabel,
  body,
  cta,
}: IntegrationCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: `1px solid ${tokens.border}`,
        bgcolor: tokens.panel,
        height: "100%",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        "&:hover": { borderColor: tokens.borderStrong },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
          <Stack direction="row" spacing={1.75} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            {tile}
            <Stack spacing={0.25}>
              <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.text }}>{name}</Typography>
              <Typography variant="body2" sx={{ color: tokens.muted, fontSize: 12.5, maxWidth: 320 }}>
                {tagline}
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill connected={connected} statusLabel={statusLabel} loading={loading} />
            {connected ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={working ? <CircularProgress size={14} /> : <LinkOffRoundedIcon sx={{ fontSize: 15 }} />}
                disabled={loading || working}
                onClick={onDisconnect}
                sx={{ borderRadius: 2, borderColor: tokens.dangerDim, color: tokens.danger, "&:hover": { borderColor: tokens.danger } }}
              >
                Disconnect
              </Button>
            ) : cta ? null : (
              <Button
                size="small"
                variant="contained"
                startIcon={working ? <CircularProgress size={14} /> : <LinkRoundedIcon sx={{ fontSize: 15 }} />}
                disabled={loading || working || !onConnect}
                onClick={onConnect}
                sx={{
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                  boxShadow: "none",
                  "&:hover": {
                    background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                    boxShadow: `0 0 0 3px ${tokens.accentGlow}`,
                  },
                }}
              >
                {connectLabel}
              </Button>
            )}
          </Stack>
        </Stack>

        <Collapse in={connected} unmountOnExit>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {body}
          </Stack>
        </Collapse>

        {!connected && cta && <Stack spacing={1.5}>{cta}</Stack>}
      </Stack>
    </Paper>
  );
}

export { panelCardSx };