"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { generateJobDescription, type JobDescriptionBrief } from "@/lib/api/hr";
import { tokens } from "@/lib/theme";

type Tone = NonNullable<JobDescriptionBrief["tone"]>;

interface Answers {
  seniority: string;
  experience: string;
  workMode: string;
  salary: string;
  responsibilities: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  benefits: string;
  companyIntro: string;
  tone: Tone;
}

// Company intro and benefits rarely change between openings, so remember them per browser.
const COMPANY_KEY = "hr.jobDescription.company";
function loadCompany(): Pick<Answers, "benefits" | "companyIntro"> {
  try { return { benefits: "", companyIntro: "", ...JSON.parse(localStorage.getItem(COMPANY_KEY) ?? "{}") }; }
  catch { return { benefits: "", companyIntro: "" }; }
}
function saveCompany(value: Pick<Answers, "benefits" | "companyIntro">) {
  try { localStorage.setItem(COMPANY_KEY, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

const STEPS = [
  { title: "About the role", hint: "A few basics so the description pitches the right level." },
  { title: "The work", hint: "What they'll do and the skills they need. Rough notes are fine." },
  { title: "The offer", hint: "Optional - the AI never invents benefits or company details." },
  { title: "Review", hint: "Edit anything before adding it to the job." },
];

export function ChoiceChips({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.text, mb: 0.75 }}>{label}</Typography>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <Chip
              key={option}
              label={option}
              onClick={() => onChange(selected ? "" : option)}
              variant={selected ? "filled" : "outlined"}
              sx={{ fontWeight: 600, bgcolor: selected ? tokens.accentDim : undefined, color: selected ? tokens.accentBright : tokens.muted, borderColor: tokens.border }}
            />
          );
        })}
      </Stack>
    </Box>
  );
}

function SkillsInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string[]; onChange: (value: string[]) => void }) {
  const [input, setInput] = useState("");
  return (
    <Autocomplete
      multiple
      freeSolo
      options={[]}
      value={value}
      inputValue={input}
      onInputChange={(_, next) => {
        // Commas add a skill too, so a pasted "React, Node, SQL" becomes three chips.
        if (next.includes(",")) {
          const parts = next.split(",").map((s) => s.trim());
          const last = parts.pop() ?? "";
          onChange([...value, ...parts.filter((p) => p && !value.includes(p))]);
          setInput(last);
        } else setInput(next);
      }}
      onChange={(_, next) => onChange(next.map((s) => s.trim()).filter(Boolean))}
      renderValue={(items, getItemProps) => items.map((item, index) => {
        const { key, ...props } = getItemProps({ index });
        return <Chip key={key} size="small" label={item} {...props} />;
      })}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? "" : placeholder} helperText="Press Enter or comma after each skill" />}
    />
  );
}

export default function JobDescriptionGenerator({ job, hasDescription, onUse }: {
  job: { title: string; team: string; location: string; employmentType: string };
  hasDescription: boolean;
  onUse: (description: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    seniority: "", experience: "", workMode: "", salary: "", responsibilities: "",
    mustHaveSkills: [], niceToHaveSkills: [], benefits: "", companyIntro: "", tone: "professional",
  });
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Answers>(key: K) => (value: Answers[K]) => setAnswers((a) => ({ ...a, [key]: value }));
  const text = (key: keyof Answers) => (e: React.ChangeEvent<HTMLInputElement>) => setAnswers((a) => ({ ...a, [key]: e.target.value }));

  function start() {
    setAnswers((a) => ({ ...a, ...loadCompany() }));
    setStep(0);
    setError(null);
    setOpen(true);
  }

  async function generate() {
    setStep(3);
    setGenerating(true);
    setError(null);
    saveCompany({ benefits: answers.benefits, companyIntro: answers.companyIntro });
    const blank = (v: string) => v.trim() || null;
    try {
      const { description } = await generateJobDescription({
        title: job.title.trim(),
        team: blank(job.team),
        location: blank(job.location),
        employmentType: job.employmentType,
        seniority: blank(answers.seniority),
        experience: blank(answers.experience),
        workMode: blank(answers.workMode),
        salary: blank(answers.salary),
        responsibilities: blank(answers.responsibilities),
        mustHaveSkills: answers.mustHaveSkills,
        niceToHaveSkills: answers.niceToHaveSkills,
        benefits: blank(answers.benefits),
        companyIntro: blank(answers.companyIntro),
        tone: answers.tone,
      });
      setDraft(description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a description");
    } finally {
      setGenerating(false);
    }
  }

  function use() {
    if (hasDescription && !window.confirm("Replace the current description with the generated one?")) return;
    onUse(draft);
    setOpen(false);
  }

  const canStart = job.title.trim().length > 0;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AutoAwesomeRoundedIcon />}
        onClick={start}
        disabled={!canStart}
        title={canStart ? undefined : "Enter a job title first"}
      >
        Generate with AI
      </Button>

      <Dialog open={open} onClose={generating ? undefined : () => setOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ pr: 6, pb: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <AutoAwesomeRoundedIcon sx={{ color: tokens.accent, fontSize: 20 }} />
            <Typography component="div" sx={{ fontSize: 17, fontWeight: 700, color: tokens.text }}>{STEPS[step].title}</Typography>
          </Stack>
          <Typography component="div" sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.25 }}>
            {job.title}{job.team ? ` · ${job.team}` : ""} - {STEPS[step].hint}
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }}>
            {STEPS.map((s, i) => <Box key={s.title} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: i <= step ? tokens.accent : tokens.border, transition: "background-color 0.2s" }} />)}
          </Stack>
          <IconButton onClick={() => setOpen(false)} disabled={generating} aria-label="Close" sx={{ position: "absolute", right: 12, top: 12 }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: tokens.border, "& .MuiInputBase-multiline": { borderRadius: "14px" } }}>
          {step === 0 && (
            <Stack spacing={2.25} sx={{ pt: 0.5 }}>
              <ChoiceChips label="Seniority" options={["Intern", "Junior", "Mid-level", "Senior", "Lead", "Manager"]} value={answers.seniority} onChange={set("seniority")} />
              <ChoiceChips label="Work mode" options={["On-site", "Hybrid", "Remote"]} value={answers.workMode} onChange={set("workMode")} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField fullWidth label="Experience required" placeholder="e.g. 5+ years" value={answers.experience} onChange={text("experience")} />
                <TextField fullWidth label="Salary range (optional)" placeholder="e.g. PKR 400k-550k / month" value={answers.salary} onChange={text("salary")} />
              </Stack>
            </Stack>
          )}

          {step === 1 && (
            <Stack spacing={2.25} sx={{ pt: 0.5 }}>
              <TextField fullWidth multiline minRows={4} maxRows={8} label="What will they do?" placeholder={"e.g. own the payments API, lead code reviews, mentor 3 juniors"} value={answers.responsibilities} onChange={text("responsibilities")} />
              <SkillsInput label="Must-have skills" placeholder="Node.js, PostgreSQL, AWS" value={answers.mustHaveSkills} onChange={set("mustHaveSkills")} />
              <SkillsInput label="Nice-to-have skills" placeholder="Kubernetes, fintech experience" value={answers.niceToHaveSkills} onChange={set("niceToHaveSkills")} />
            </Stack>
          )}

          {step === 2 && (
            <Stack spacing={2.25} sx={{ pt: 0.5 }}>
              <TextField fullWidth multiline minRows={3} maxRows={6} label="Benefits and perks" placeholder="Health insurance, annual bonus, flexible hours..." value={answers.benefits} onChange={text("benefits")} />
              <TextField fullWidth multiline minRows={3} maxRows={6} label="About the company" placeholder="What you do, team size, mission..." value={answers.companyIntro} onChange={text("companyIntro")} helperText="Benefits and company info are remembered for your next job." />
              <ChoiceChips label="Tone" options={["Professional", "Friendly", "Concise"]} value={answers.tone[0].toUpperCase() + answers.tone.slice(1)} onChange={(v) => set("tone")((v || "Professional").toLowerCase() as Tone)} />
            </Stack>
          )}

          {step === 3 && (
            <Box sx={{ pt: 0.5 }}>
              {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
              {generating ? (
                <Stack spacing={1.5} sx={{ py: 5, alignItems: "center" }}>
                  <LinearProgress sx={{ width: "60%", borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 13, color: tokens.muted }}>Writing your job description...</Typography>
                </Stack>
              ) : draft ? (
                <TextField fullWidth multiline minRows={12} maxRows={20} value={draft} onChange={(e) => setDraft(e.target.value)} slotProps={{ input: { sx: { fontSize: 13.5, lineHeight: 1.6 } } }} />
              ) : null}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.75 }}>
          {step > 0 && <Button onClick={() => setStep(step - 1)} disabled={generating} sx={{ color: tokens.muted, mr: "auto" }}>Back</Button>}
          {step < 2 && <Button variant="contained" onClick={() => setStep(step + 1)}>Next</Button>}
          {step === 2 && <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => void generate()}>Generate</Button>}
          {step === 3 && <>
            <Button onClick={() => void generate()} disabled={generating} startIcon={generating ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}>Regenerate</Button>
            <Button variant="contained" onClick={use} disabled={generating || !draft.trim()}>Use this description</Button>
          </>}
        </DialogActions>
      </Dialog>
    </>
  );
}
