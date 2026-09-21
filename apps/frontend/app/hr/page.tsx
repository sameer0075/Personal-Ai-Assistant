"use client";

import { useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import Sidebar from "@/components/Sidebar";
import RequireAuth from "@/lib/auth/RequireAuth";
import { useWorkspace } from "@/lib/workspaces/WorkspaceProvider";
import { tokens } from "@/lib/theme";
import HrOperationsPanel from "@/components/hr/HrOperationsPanel";
import CareerIntakeCard from "@/components/hr/CareerIntakeCard";

function HrView() {
  const { activeWorkspace } = useWorkspace();
  const [intakeError, setIntakeError] = useState<string | null>(null);

  return (
    <Box sx={{ display: "flex", height: "100dvh", bgcolor: tokens.bg }}>
      <Sidebar />
      <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <Stack direction="row" sx={{ px: 3, py: 1.5, alignItems: "center", gap: 1, borderBottom: `1px solid ${tokens.border}`, bgcolor: tokens.panelGlass }}>
          <Button component={Link} href="/departments" size="small" startIcon={<ArrowBackRoundedIcon />} sx={{ color: tokens.muted }}>Departments</Button>
          <Typography sx={{ fontSize: 13, color: tokens.mutedDim }}>/</Typography>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>HR Management</Typography>
        </Stack>
        <Box sx={{ maxWidth: 1100, mx: "auto", px: { xs: 2, md: 3 }, py: 4 }}>
          {activeWorkspace?.kind !== "work" ? (
            <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <Typography sx={{ fontSize: 22, fontWeight: 700, color: tokens.text }}>HR lives in Work</Typography>
              <Typography sx={{ color: tokens.muted }}>Switch to your Work workspace to manage people, hiring, and HR documents.</Typography>
            </Stack>
          ) : (
            <Stack spacing={3} key={activeWorkspace.id}>
              <Stack direction={{ xs: "column", md: "row" }} sx={{ justifyContent: "space-between", alignItems: { md: "center" }, gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 25, fontWeight: 700, color: tokens.text }}>HR command center</Typography>
                  <Typography sx={{ mt: 0.5, color: tokens.muted, maxWidth: 640 }}>
                    People, hiring, events, and policies in one place. Everything here is available to your HR assistant.
                  </Typography>
                </Box>
                <Button component={Link} href="/" variant="contained" startIcon={<AutoAwesomeRoundedIcon />} sx={{ alignSelf: { xs: "stretch", md: "auto" } }}>
                  Ask HR assistant
                </Button>
              </Stack>

              <HrOperationsPanel />

              {intakeError && <Alert severity="error" onClose={() => setIntakeError(null)}>{intakeError}</Alert>}
              <CareerIntakeCard onError={setIntakeError} />
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function HrPage() {
  return <RequireAuth><HrView /></RequireAuth>;
}
