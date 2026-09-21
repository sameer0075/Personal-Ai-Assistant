"use client";

import { useMemo, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import HowToRegRoundedIcon from "@mui/icons-material/HowToRegRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import {
  createHrApplicant,
  deleteHrApplicant,
  hireHrApplicant,
  openHrDocument,
  updateHrApplicant,
  uploadApplicantResume,
  type HrApplicant,
  type HrApplicantInput,
  type HrApplicantStage,
  type HrEmployee,
  type HrJob,
} from "@/lib/api/hr";
import { tokens } from "@/lib/theme";
import { EmptyState, FormDialog, RecordRow, ResumeField, StatusChip, Toolbar, full, orNull, pasteKeepingLines, type Tone } from "./hrUi";

export const STAGES: Record<HrApplicantStage, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "blue" },
  screening: { label: "Screening", tone: "purple" },
  interview: { label: "Interview", tone: "amber" },
  offer: { label: "Offer", tone: "green" },
  hired: { label: "Hired", tone: "green" },
  rejected: { label: "Rejected", tone: "grey" },
};

const EMPTY_FORM = { fullName: "", email: "", phone: "", position: "", coverLetter: "", notes: "", stage: "new" as HrApplicantStage };

export default function ApplicantsTab({ applicants, setApplicants, jobs, onHired, onError }: {
  applicants: HrApplicant[];
  setApplicants: (update: (current: HrApplicant[]) => HrApplicant[]) => void;
  jobs: HrJob[];
  onHired: (employee: HrEmployee) => void;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<HrApplicantStage | "all">("all");
  const [editing, setEditing] = useState<HrApplicant | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [resume, setResume] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applicants.filter((a) =>
      (stageFilter === "all" || a.stage === stageFilter) &&
      (!q || [a.fullName, a.email, a.phone, a.jobTitle, a.position].some((v) => v?.toLowerCase().includes(q))));
  }, [applicants, search, stageFilter]);

  const counts = useMemo(() => applicants.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.stage]: (acc[a.stage] ?? 0) + 1 }), {}), [applicants]);

  function openEditor(applicant: HrApplicant | "new") {
    setEditing(applicant);
    setResume(null);
    setForm(applicant === "new" ? EMPTY_FORM : {
      fullName: applicant.fullName,
      email: applicant.email ?? "",
      phone: applicant.phone ?? "",
      position: applicant.jobTitle ?? applicant.position ?? "",
      coverLetter: applicant.coverLetter ?? "",
      notes: applicant.notes ?? "",
      stage: applicant.stage,
    });
  }

  const upsert = (row: HrApplicant) => setApplicants((current) =>
    current.some((a) => a.id === row.id) ? current.map((a) => (a.id === row.id ? row : a)) : [row, ...current]);

  async function save() {
    if (!editing) return;
    setBusy(true);
    // Free text; link to a job opening when the text matches one exactly.
    const position = orNull(form.position);
    const job = position ? jobs.find((j) => j.title.trim().toLowerCase() === position.toLowerCase()) : undefined;
    const input: HrApplicantInput = {
      fullName: form.fullName.trim(),
      email: orNull(form.email),
      phone: orNull(form.phone),
      jobId: job?.id ?? null,
      position,
      coverLetter: orNull(form.coverLetter),
      notes: orNull(form.notes),
      stage: form.stage,
    };
    try {
      let saved = editing === "new" ? await createHrApplicant(input) : await updateHrApplicant(editing.id, input);
      upsert(saved);
      if (resume) {
        try {
          saved = await uploadApplicantResume(saved.id, resume);
          upsert(saved);
        } catch (err) {
          onError(`${saved.fullName} was saved, but the CV could not be uploaded: ${err instanceof Error ? err.message : "unknown error"}`);
        }
      }
      setEditing(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save applicant");
    } finally {
      setBusy(false);
    }
  }

  async function changeStage(applicant: HrApplicant, stage: HrApplicantStage) {
    // Choosing "Hired" is the natural moment to add them to People - offer it in the same step.
    if (stage === "hired" && !applicant.employeeId && window.confirm(`Also add ${applicant.fullName} to People?`)) {
      await hire(applicant, false);
      return;
    }
    try { upsert(await updateHrApplicant(applicant.id, { stage })); }
    catch (err) { onError(err instanceof Error ? err.message : "Could not update stage"); }
  }

  async function hire(applicant: HrApplicant, confirm = true) {
    const role = applicant.jobTitle ?? applicant.position;
    if (confirm && !window.confirm(`Move ${applicant.fullName} to People${role ? ` as ${role}` : ""}? Their details and CV are copied over and the application is marked Hired.`)) return;
    try {
      const employee = await hireHrApplicant(applicant.id);
      upsert({ ...applicant, stage: "hired", employeeId: employee.id });
      onHired(employee);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not hire applicant");
    }
  }

  async function remove(applicant: HrApplicant) {
    if (!window.confirm(`Delete ${applicant.fullName}'s application?`)) return;
    try {
      await deleteHrApplicant(applicant.id);
      setApplicants((current) => current.filter((a) => a.id !== applicant.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete applicant");
    }
  }

  const openCv = (id: string) => openHrDocument(id).catch((err) => onError(err instanceof Error ? err.message : "Could not open CV"));
  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const current = editing && editing !== "new" ? editing : null;

  return (
    <Stack spacing={2}>
      <Toolbar search={search} onSearch={setSearch} placeholder="Search applicants or positions" actionLabel="Add applicant" onAction={() => openEditor("new")} />

      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
        {(["all", ...Object.keys(STAGES)] as Array<HrApplicantStage | "all">).map((stage) => {
          const selected = stageFilter === stage;
          const count = stage === "all" ? applicants.length : counts[stage] ?? 0;
          return (
            <Chip
              key={stage}
              label={`${stage === "all" ? "All" : STAGES[stage].label} ${count}`}
              onClick={() => setStageFilter(stage)}
              variant={selected ? "filled" : "outlined"}
              sx={{ fontWeight: 600, bgcolor: selected ? tokens.accentDim : undefined, color: selected ? tokens.accentBright : tokens.muted, borderColor: tokens.border }}
            />
          );
        })}
      </Stack>

      {applicants.length === 0 ? (
        <EmptyState icon={<PersonSearchRoundedIcon />} title="No applicants yet" hint="Applications sent from your careers page appear here automatically, or add one yourself." />
      ) : visible.length === 0 ? (
        <EmptyState icon={<PersonSearchRoundedIcon />} title="No matches" hint="Try a different stage or search." />
      ) : (
        <Stack spacing={1}>
          {visible.map((applicant) => (
            <RecordRow
              key={applicant.id}
              onClick={() => openEditor(applicant)}
              leading={<Avatar sx={{ width: 36, height: 36, bgcolor: "#e6effa", color: "#2c5f9e", fontSize: 14, fontWeight: 700 }}>{applicant.fullName.slice(0, 1).toUpperCase()}</Avatar>}
              title={applicant.fullName}
              subtitle={[applicant.jobTitle ?? applicant.position ?? "General application", applicant.email, applicant.phone, new Date(applicant.createdAt).toLocaleDateString()].filter(Boolean).join(" · ")}
              meta={<>
                {applicant.source === "career_site" && <StatusChip label="Career site" tone="purple" />}
                {applicant.employeeId && <StatusChip label="In People" tone="green" />}
                <TextField
                  select
                  size="small"
                  value={applicant.stage}
                  onChange={(e) => void changeStage(applicant, e.target.value as HrApplicantStage)}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ minWidth: 124, "& .MuiInputBase-input": { py: 0.5, fontSize: 12.5 } }}
                >
                  {Object.entries(STAGES).map(([value, { label }]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                </TextField>
              </>}
              actions={<>
                {applicant.resumeDocumentId && <Tooltip title="Open CV"><IconButton size="small" onClick={() => void openCv(applicant.resumeDocumentId!)}><DescriptionRoundedIcon sx={{ fontSize: 18, color: tokens.accent }} /></IconButton></Tooltip>}
                {!applicant.employeeId && <Tooltip title="Move to People"><IconButton size="small" onClick={() => void hire(applicant)}><HowToRegRoundedIcon sx={{ fontSize: 18, color: tokens.accent }} /></IconButton></Tooltip>}
                <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditor(applicant)}><EditRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" onClick={() => void remove(applicant)}><DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              </>}
            />
          ))}
        </Stack>
      )}

      <FormDialog
        open={editing !== null}
        title={current ? current.fullName : "Add an applicant"}
        subtitle={current ? `${current.source === "career_site" ? "Applied via career site" : "Added manually"} on ${new Date(current.createdAt).toLocaleDateString()}` : "Track a candidate through your hiring pipeline."}
        submitLabel={current ? "Save changes" : "Add applicant"}
        busy={busy}
        canSubmit={form.fullName.trim().length > 0}
        onClose={() => setEditing(null)}
        onSubmit={() => void save()}
      >
        <TextField sx={full} size="small" label="Full name" required autoFocus={!current} value={form.fullName} onChange={set("fullName")} />
        <TextField size="small" label="Email address" type="email" value={form.email} onChange={set("email")} />
        <TextField size="small" label="Phone" value={form.phone} onChange={set("phone")} />
        <Autocomplete
          freeSolo
          size="small"
          options={jobs.filter((j) => j.status === "open").map((j) => j.title)}
          inputValue={form.position}
          onInputChange={(_, value) => setForm((f) => ({ ...f, position: value }))}
          renderInput={(params) => <TextField {...params} label="Position" placeholder="e.g. QA Engineer, Accountant" />}
        />
        <TextField size="small" select label="Stage" value={form.stage} onChange={set("stage")}>
          {Object.entries(STAGES).map(([value, { label }]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <ResumeField
          currentName={current?.resumeFilename ?? null}
          onOpenCurrent={current?.resumeDocumentId ? () => void openCv(current.resumeDocumentId!) : undefined}
          pending={resume}
          onPick={setResume}
        />
        <TextField sx={full} size="small" label="Cover letter" multiline minRows={3} maxRows={8} value={form.coverLetter} onChange={set("coverLetter")} onPaste={pasteKeepingLines((update) => setForm((f) => ({ ...f, coverLetter: update(f.coverLetter) })))} />
        <TextField sx={full} size="small" label="Internal notes" placeholder="Interview feedback, next steps..." multiline minRows={2} maxRows={6} value={form.notes} onChange={set("notes")} />
      </FormDialog>
    </Stack>
  );
}
