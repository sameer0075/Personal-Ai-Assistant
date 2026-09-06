"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Sidebar from "@/components/Sidebar";
import GoogleCard from "@/components/integrations/GoogleCard";
import LinkedInCard from "@/components/integrations/LinkedInCard";
import GithubCard from "@/components/integrations/GithubCard";
import { tokens } from "@/lib/theme";

const OAUTH_CALLBACK_PARAMS = ["google", "linkedin"] as const;

type ConnectionState = { google: boolean; linkedin: boolean; github: boolean };

function ConnectionSummary({ state }: { state: ConnectionState }) {
  const connected = Object.values(state).filter(Boolean).length;
  const total = Object.values(state).length;
  const allConnected = connected === total;

  let label = `${connected} of ${total} services connected`;
  if (allConnected) {
    label = `All ${total} services connected`;
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        px: 1.25,
        py: 0.5,
        borderRadius: 99,
        border: `1px solid ${allConnected ? tokens.accentDim : tokens.border}`,
        bgcolor: allConnected ? tokens.accentDim : tokens.panel,
        width: "fit-content",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 99,
          flexShrink: 0,
          background: allConnected ? tokens.accent : tokens.mutedDim,
        }}
      />
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: allConnected ? tokens.accentBright : tokens.muted, fontFamily: "var(--font-mono)" }}>
        {label}
      </Typography>
    </Stack>
  );
}

export default function IntegrationsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [callbackNote, setCallbackNote] = useState<{ message: string; severity: "success" | "error" } | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({ google: false, linkedin: false, github: false });

  useEffect(() => {
    for (const provider of OAUTH_CALLBACK_PARAMS) {
      const value = searchParams.get(provider);
      if (!value) continue;

      const label = provider === "google" ? "Google" : "LinkedIn";
      setCallbackNote(
        value === "connected"
          ? { message: `${label} account connected.`, severity: "success" }
          : { message: `Failed to connect ${label} account. Please try again.`, severity: "error" }
      );
      router.replace("/integrations"); // strip the query param so a refresh doesn't re-show the toast
      break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box sx={{ display: "flex", height: "100dvh", bgcolor: tokens.bg }}>
      <Sidebar />

      <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <Stack
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${tokens.border}`,
            bgcolor: tokens.panelGlass,
            backdropFilter: "blur(10px)",
          }}
        >
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.text }}>Integrations</Typography>
        </Stack>

        <Box sx={{ maxWidth: 1080, mx: "auto", px: 3, py: 4 }}>
          <Stack spacing={3}>
            <Stack spacing={1.25}>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: tokens.text, letterSpacing: "-0.01em" }}>
                  Integrations
                </Typography>
                <ConnectionSummary state={connectionState} />
              </Stack>
              <Typography variant="body2" sx={{ color: tokens.muted, maxWidth: 620 }}>
                Link the accounts the assistant can read and act across — Gmail, Calendar, LinkedIn, and GitHub. Every draft
                still opens a review step before anything is sent or published.
              </Typography>
            </Stack>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                gap: 2,
                alignItems: "start",
              }}
            >
              <Box sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}>
                <GoogleCard
                  onConnectedChange={(connected) => setConnectionState((s) => ({ ...s, google: connected }))}
                />
              </Box>
              <LinkedInCard
                onConnectedChange={(connected) => setConnectionState((s) => ({ ...s, linkedin: connected }))}
              />
              <GithubCard
                onConnectedChange={(connected) => setConnectionState((s) => ({ ...s, github: connected }))}
              />
            </Box>
          </Stack>
        </Box>
      </Box>

      <Snackbar
        open={callbackNote !== null}
        autoHideDuration={5000}
        onClose={() => setCallbackNote(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {callbackNote ? (
          <Alert
            severity={callbackNote.severity}
            variant="filled"
            onClose={() => setCallbackNote(null)}
            sx={{ width: "100%" }}
          >
            {callbackNote.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}