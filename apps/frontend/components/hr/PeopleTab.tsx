"use client";

import { useMemo, useState } from "react";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import {
  createHrEmployee,
  deleteHrEmployee,
  openHrDocument,
  updateHrEmployee,
  uploadEmployeeResume,
  type HrEmployee,
  type HrEmployeeInput,
  type HrEmployeeStatus,
} from "@/lib/api/hr";
import { tokens } from "@/lib/theme";
import { EmptyState, FormDialog, RecordRow, ResumeField, StatusChip, Toolbar, full, orNull, type Tone } from "./hrUi";

const STATUS: Record<HrEmployeeStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  on_leave: { label: "On leave", tone: "amber" },
  candidate: { label: "Candidate", tone: "blue" },
  former: { label: "Former", tone: "grey" },
};

const EMPTY_FORM = { fullName: "", email: "", phone: "", role: "", status: "active" as HrEmployeeStatus, startDate: "" };

export default function PeopleTab({ employees, setEmployees, onError }: {
  employees: HrEmployee[];
  setEmployees: (update: (current: HrEmployee[]) => HrEmployee[]) => void;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<HrEmployee | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resume, setResume] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => [e.fullName, e.email, e.phone, e.role].some((v) => v?.toLowerCase().includes(q)));
  }, [employees, search]);

  function openEditor(employee: HrEmployee | "new") {
    setEditing(employee);
    setResume(null);
    setForm(employee === "new" ? EMPTY_FORM : {
      fullName: employee.fullName,
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      role: employee.role ?? "",
      status: employee.status,
      startDate: employee.startDate ?? "",
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const input: HrEmployeeInput = {
      fullName: form.fullName.trim(),
      email: orNull(form.email),
      phone: orNull(form.phone),
      role: orNull(form.role),
      status: form.status,
      startDate: orNull(form.startDate),
    };
    try {
      let saved = editing === "new" ? await createHrEmployee(input) : await updateHrEmployee(editing.id, input);
      const upsert = (row: HrEmployee) => setEmployees((current) =>
        (current.some((e) => e.id === row.id) ? current.map((e) => (e.id === row.id ? row : e)) : [...current, row])
          .sort((a, b) => a.fullName.localeCompare(b.fullName)));
      upsert(saved);
      if (resume) {
        try {
          saved = await uploadEmployeeResume(saved.id, resume);
          upsert(saved);
        } catch (err) {
          onError(`${saved.fullName} was saved, but the CV could not be uploaded: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }
      setEditing(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save person");
    } finally {
      setBusy(false);
    }
  }

  async function remove(employee: HrEmployee) {
    if (!window.confirm(`Remove ${employee.fullName} from the people directory?${employee.resumeDocumentId ? " Their CV will be deleted too." : ""}`)) return;
    try {
      await deleteHrEmployee(employee.id);
      setEmployees((current) => current.filter((e) => e.id !== employee.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not remove person");
    }
  }

  const openCv = (id: string) => openHrDocument(id).catch((err) => onError(err instanceof Error ? err.message : "Could not open CV"));
  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const current = editing && editing !== "new" ? editing : null;

  return (
    <Stack spacing={2}>
      <Toolbar search={search} onSearch={setSearch} placeholder="Search by name, email, phone, or role" actionLabel="Add person" onAction={() => openEditor("new")} />

      {employees.length === 0 ? (
        <EmptyState icon={<PeopleAltRoundedIcon />} title="Your people directory is empty" hint="Add employees with their contact details and CV. Hired applicants land here automatically." />
      ) : visible.length === 0 ? (
        <EmptyState icon={<PeopleAltRoundedIcon />} title="No matches" hint={`Nobody matches "${search}".`} />
      ) : (
        <Stack spacing={1}>
          {visible.map((employee) => (
            <RecordRow
              key={employee.id}
              onClick={() => openEditor(employee)}
              leading={<Avatar sx={{ width: 36, height: 36, bgcolor: tokens.accentDim, color: tokens.accentBright, fontSize: 14, fontWeight: 700 }}>{employee.fullName.slice(0, 1).toUpperCase()}</Avatar>}
              title={employee.fullName}
              subtitle={[employee.role, employee.email, employee.phone].filter(Boolean).join(" · ") || "No contact details yet"}
              meta={<StatusChip {...STATUS[employee.status]} />}
              actions={<>
                {employee.resumeDocumentId && <Tooltip title="Open CV"><IconButton size="small" onClick={() => void openCv(employee.resumeDocumentId!)}><DescriptionRoundedIcon sx={{ fontSize: 18, color: tokens.accent }} /></IconButton></Tooltip>}
                <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditor(employee)}><EditRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Remove"><IconButton size="small" onClick={() => void remove(employee)}><DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              </>}
            />
          ))}
        </Stack>
      )}

      <FormDialog
        open={editing !== null}
        title={current ? `Edit ${current.fullName}` : "Add a person"}
        subtitle="Contact details and CV are available to the HR assistant."
        submitLabel={current ? "Save changes" : "Add person"}
        busy={busy}
        canSubmit={form.fullName.trim().length > 0}
        onClose={() => setEditing(null)}
        onSubmit={() => void save()}
      >
        <TextField sx={full} size="small" label="Full name" required autoFocus value={form.fullName} onChange={set("fullName")} />
        <TextField size="small" label="Email address" type="email" value={form.email} onChange={set("email")} />
        <TextField size="small" label="Phone" value={form.phone} onChange={set("phone")} />
        <TextField size="small" label="Role" value={form.role} onChange={set("role")} />
        <TextField size="small" select label="Status" value={form.status} onChange={set("status")}>
          {Object.entries(STATUS).map(([value, { label }]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField sx={full} size="small" type="date" label="Start date" value={form.startDate} onChange={set("startDate")} slotProps={{ inputLabel: { shrink: true } }} />
        <ResumeField
          currentName={current?.resumeFilename ?? null}
          onOpenCurrent={current?.resumeDocumentId ? () => void openCv(current.resumeDocumentId!) : undefined}
          pending={resume}
          onPick={setResume}
        />
      </FormDialog>
    </Stack>
  );
}
