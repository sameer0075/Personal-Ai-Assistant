"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Sidebar from "@/components/Sidebar";
import DepartmentManager from "@/components/workspaces/DepartmentManager";
import RequireAuth from "@/lib/auth/RequireAuth";
import { useWorkspace } from "@/lib/workspaces/WorkspaceProvider";
import { tokens } from "@/lib/theme";

function DepartmentsView() {
  const { activeWorkspace } = useWorkspace();

  return (
    <Box sx={{ display: "flex", height: "100dvh", bgcolor: tokens.bg }}>
      <Sidebar />
      <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <Stack sx={{ px: 3, py: 2, borderBottom: `1px solid ${tokens.border}`, bgcolor: tokens.panelGlass }}>
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.text }}>Departments</Typography>
        </Stack>
        <Box sx={{ maxWidth: 920, mx: "auto", px: 3, py: 4 }}>
          <Stack spacing={1} sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 700, color: tokens.text }}>Work departments</Typography>
            <Typography sx={{ fontSize: 13, color: tokens.muted }}>
              Manage the teams and client stages used by your Work workspace.
            </Typography>
          </Stack>
          {activeWorkspace?.kind === "work" ? (
            <DepartmentManager />
          ) : (
            <Typography sx={{ color: tokens.muted }}>Switch to Work to manage departments.</Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function DepartmentsPage() {
  return <RequireAuth><DepartmentsView /></RequireAuth>;
}