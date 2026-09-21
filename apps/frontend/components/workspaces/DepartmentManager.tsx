"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspaces/WorkspaceProvider";
import { createDepartment, deleteDepartment, updateDepartment } from "@/lib/api/workspaces";
import { tokens } from "@/lib/theme";

export default function DepartmentManager() {
  const { activeWorkspace, refreshWorkspaces } = useWorkspace();
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName("");
    setEditingId(null);
    setError(null);
  }, [activeWorkspace?.id]);

  if (activeWorkspace?.kind !== "work") return null;

  const parents = activeWorkspace.departments.filter((department) => !department.parentId);
  const children = activeWorkspace.departments.filter((department) => department.parentId);

  async function addDepartment() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createDepartment(name.trim());
      setName("");
      await refreshWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add department");
    } finally {
      setBusy(false);
    }
  }

  async function saveDepartment(id: string) {
    if (!editingName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateDepartment(id, editingName.trim());
      setEditingId(null);
      await refreshWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update department");
    } finally {
      setBusy(false);
    }
  }

  async function removeDepartment(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteDepartment(id);
      await refreshWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete department");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 2, bgcolor: tokens.panel, p: 2.25 }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.text }}>Work departments</Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.5 }}>
              Organize work conversations, resources, and future account data.
            </Typography>
          </Box>
          <Chip size="small" label={`${activeWorkspace.departments.length} total`} sx={{ bgcolor: tokens.accentDim, color: tokens.accentBright }} />
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            size="small"
            fullWidth
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void addDepartment()}
            placeholder="Add a custom department"
            disabled={busy}
          />
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => void addDepartment()} disabled={busy || !name.trim()} sx={{ whiteSpace: "nowrap" }}>
            Add department
          </Button>
        </Stack>

        <Stack spacing={1}>
          {parents.map((department) => {
            const nested = children.filter((child) => child.parentId === department.id);
            const editing = editingId === department.id;
            return (
              <Box key={department.id} sx={{ border: `1px solid ${tokens.border}`, borderRadius: 1.5, px: 1.25, py: 1 }}>
                <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
                  {editing ? (
                    <TextField size="small" value={editingName} onChange={(event) => setEditingName(event.target.value)} autoFocus sx={{ flex: 1 }} />
                  ) : (
                    <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 600, color: tokens.text }}>{department.name}</Typography>
                  )}
                  <Button
                    component={Link}
                    href={department.name === "HR Management" ? "/hr" : `/departments?departmentId=${department.id}`}
                    size="small"
                    startIcon={<VisibilityRoundedIcon />}
                    sx={{ textTransform: "none", color: tokens.accentBright }}
                  >
                    View
                  </Button>
                  {department.isDefault ? (
                    <Chip size="small" label="Default" sx={{ height: 22, color: tokens.muted, bgcolor: tokens.panelRaised }} />
                  ) : editing ? (
                    <>
                      <IconButton size="small" onClick={() => void saveDepartment(department.id)} disabled={busy} aria-label="Save department"><CheckRoundedIcon sx={{ fontSize: 17 }} /></IconButton>
                      <IconButton size="small" onClick={() => setEditingId(null)} aria-label="Cancel editing"><CloseRoundedIcon sx={{ fontSize: 17 }} /></IconButton>
                    </>
                  ) : (
                    <>
                      <IconButton size="small" onClick={() => { setEditingId(department.id); setEditingName(department.name); }} aria-label={`Edit ${department.name}`}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                      <IconButton size="small" onClick={() => void removeDepartment(department.id)} disabled={busy} aria-label={`Delete ${department.name}`}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                    </>
                  )}
                </Stack>
                {nested.length > 0 && <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: "wrap", gap: 0.5 }}>{nested.map((child) => <Chip key={child.id} size="small" label={child.name} sx={{ color: tokens.muted, bgcolor: tokens.panelRaised }} />)}</Stack>}
              </Box>
            );
          })}
          {busy && <CircularProgress size={16} sx={{ color: tokens.accent }} />}
        </Stack>
        {error && <Typography sx={{ fontSize: 12, color: tokens.danger }}>{error}</Typography>}
      </Stack>
    </Box>
  );
}