"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import { createHrJob, deleteHrJob, updateHrJob, type HrEmploymentType, type HrJob, type HrJobInput, type HrJobStatus } from "@/lib/api/hr";
import { tokens } from "@/lib/theme";
import { EmptyState, FormDialog, RecordRow, StatusChip, Toolbar, full, orNull, pasteKeepingLines, type Tone } from "./hrUi";
import JobDescriptionGenerator from "./JobDescriptionGenerator";

const STATUS: Record<HrJobStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "green" },
  draft: { label: "Draft", tone: "amber" },
  closed: { label: "Closed", tone: "grey" },
};

export const EMPLOYMENT_TYPES: Record<HrEmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  internship: "Internship",
};

const EMPTY_FORM = { title: "", team: "", location: "", employmentType: "full_time" as HrEmploymentType, description: "", status: "open" as HrJobStatus };

export default function JobsTab({ jobs, setJobs, onError }: {
  jobs: HrJob[];
  setJobs: (update: (current: HrJob[]) => HrJob[]) => void;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<HrJob | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((j) => [j.title, j.team, j.location].some((v) => v?.toLowerCase().includes(q)));
  }, [jobs, search]);

  function openEditor(job: HrJob | "new") {
    setEditing(job);
    setForm(job === "new" ? EMPTY_FORM : {
      title: job.title,
      team: job.team ?? "",
      location: job.location ?? "",
      employmentType: job.employmentType,
      description: job.description ?? "",
      status: job.status,
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const input: HrJobInput = {
      title: form.title.trim(),
      team: orNull(form.team),
      location: orNull(form.location),
      employmentType: form.employmentType,
      description: orNull(form.description),
      status: form.status,
    };
    try {
      const saved = editing === "new" ? await createHrJob(input) : await updateHrJob(editing.id, input);
      setJobs((current) => current.some((j) => j.id === saved.id) ? current.map((j) => (j.id === saved.id ? saved : j)) : [saved, ...current]);
      setEditing(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save job");
    } finally {
      setBusy(false);
    }
  }

  async function remove(job: HrJob) {
    const note = job.applicantCount ? ` Its ${job.applicantCount} applicant(s) will be kept as general applications.` : "";
    if (!window.confirm(`Delete the "${job.title}" opening?${note}`)) return;
    try {
      await deleteHrJob(job.id);
      setJobs((current) => current.filter((j) => j.id !== job.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete job");
    }
  }

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const current = editing && editing !== "new" ? editing : null;

  return (
    <Stack spacing={2}>
      <Toolbar search={search} onSearch={setSearch} placeholder="Search openings by title, team, or location" actionLabel="New job" onAction={() => openEditor("new")} />

      {jobs.length === 0 ? (
        <EmptyState icon={<WorkOutlineRoundedIcon />} title="No job openings" hint="Open positions are listed on your careers endpoint so applicants can apply to a specific role." />
      ) : visible.length === 0 ? (
        <EmptyState icon={<WorkOutlineRoundedIcon />} title="No matches" hint={`No openings match "${search}".`} />
      ) : (
        <Stack spacing={1}>
          {visible.map((job) => (
            <RecordRow
              key={job.id}
              onClick={() => openEditor(job)}
              leading={<Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: tokens.accentDim, color: tokens.accentBright }}><WorkOutlineRoundedIcon sx={{ fontSize: 19 }} /></Box>}
              title={job.title}
              subtitle={[job.team, job.location, EMPLOYMENT_TYPES[job.employmentType]].filter(Boolean).join(" · ")}
              meta={<>
                <StatusChip label={`${job.applicantCount} applicant${job.applicantCount === 1 ? "" : "s"}`} tone="blue" />
                <StatusChip {...STATUS[job.status]} />
              </>}
              actions={<>
                <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditor(job)}><EditRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" onClick={() => void remove(job)}><DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              </>}
            />
          ))}
        </Stack>
      )}

      <FormDialog
        open={editing !== null}
        title={current ? `Edit ${current.title}` : "New job opening"}
        subtitle="Open jobs are visible to your careers page. Drafts and closed jobs are not."
        submitLabel={current ? "Save changes" : "Create job"}
        busy={busy}
        canSubmit={form.title.trim().length > 0}
        onClose={() => setEditing(null)}
        onSubmit={() => void save()}
      >
        <TextField sx={full} size="small" label="Job title" required autoFocus value={form.title} onChange={set("title")} />
        <TextField size="small" label="Team" value={form.team} onChange={set("team")} />
        <TextField size="small" label="Location" placeholder="Remote, Lahore, ..." value={form.location} onChange={set("location")} />
        <TextField size="small" select label="Employment type" value={form.employmentType} onChange={set("employmentType")}>
          {Object.entries(EMPLOYMENT_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Status" value={form.status} onChange={set("status")}>
          {Object.entries(STATUS).map(([value, { label }]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <Stack direction="row" sx={{ ...full, alignItems: "center", justifyContent: "space-between", gap: 1, mt: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>Description</Typography>
            <Typography sx={{ fontSize: 11.5, color: tokens.muted }}>Write it, paste it, or let AI draft it from a few questions.</Typography>
          </Box>
          <JobDescriptionGenerator
            job={{ title: form.title, team: form.team, location: form.location, employmentType: form.employmentType }}
            hasDescription={form.description.trim().length > 0}
            onUse={(description) => setForm((f) => ({ ...f, description }))}
          />
        </Stack>
        <TextField
          sx={full}
          size="small"
          placeholder={"About the role\n\nWhat you'll do\n• ...\n\nWhat you'll bring\n• ..."}
          multiline
          minRows={8}
          maxRows={16}
          value={form.description}
          onChange={set("description")}
          onPaste={pasteKeepingLines((update) => setForm((f) => ({ ...f, description: update(f.description) })))}
          slotProps={{ htmlInput: { "aria-label": "Description" }, input: { sx: { fontSize: 13.5, lineHeight: 1.6, alignItems: "flex-start" } } }}
        />
      </FormDialog>
    </Stack>
  );
}
