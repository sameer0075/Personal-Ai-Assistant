"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Sidebar from "@/components/Sidebar";
import GoogleConnectCard from "@/components/GoogleConnectCard";
import GmailPanel from "@/components/GmailPanel";
import CalendarPanel from "@/components/CalendarPanel";
import { tokens } from "@/lib/theme";

export default function IntegrationsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [callbackNote, setCallbackNote] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (googleParam === "connected") {
      setCallbackNote({ message: "Google account connected.", severity: "success" });
    } else if (googleParam === "error") {
      setCallbackNote({ message: "Failed to connect Google account. Please try again.", severity: "error" });
    }
    if (googleParam) {
      router.replace("/integrations"); // strip the query param so a refresh doesn't re-show the toast
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

        <Container maxWidth="sm" sx={{ py: 4 }}>
          <Stack spacing={3}>
            <GoogleConnectCard />
            <GmailPanel />
            <CalendarPanel />
          </Stack>
        </Container>
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