"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import { generateEventDescription, type EventDescriptionBrief } from "@/lib/api/hr";
import { tokens } from "@/lib/theme";
import { ChoiceChips } from "./JobDescriptionGenerator";

type Tone = NonNullable<EventDescriptionBrief["tone"]>;

const EMPTY = { purpose: "", audience: "", agenda: "", preparation: "", location: "", host: "", tone: "friendly" as Tone };

export default function EventDescriptionGenerator({ event, hasDescription, onUse }: {
  event: { title: string; eventTypeLabel: string };
  hasDescription: boolean;
  onUse: (description: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"questions" | "review">("questions");
  const [answers, setAnswers] = useState(EMPTY);
  const [draft, setDraft] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setAnswers((a) => ({ ...a, [key]: e.target.value }));

  async function generate() {
    setStep("review");
    setGenerating(true);
    setError(null);
    const blank = (v: string) => v.trim() || null;
    try {
      const { description } = await generateEventDescription({
        title: event.title.trim(),
        eventType: event.eventTypeLabel,
        purpose: blank(answers.purpose),
        audience: blank(answers.audience),
        agenda: blank(answers.agenda),
        preparation: blank(answers.preparation),
        location: blank(answers.location),
        host: blank(answers.host),
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

  const canStart = event.title.trim().length > 0;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<AutoAwesomeRoundedIcon />}
        onClick={() => { setStep("questions"); setError(null); setOpen(true); }}
        disabled={!canStart}
        title={canStart ? undefined : "Enter an event title first"}
      >
        Generate with AI
      </Button>

      <Dialog open={open} onClose={generating ? undefined : () => setOpen(false)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ pr: 6, pb: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <AutoAwesomeRoundedIcon sx={{ color: tokens.accent, fontSize: 20 }} />
            <Typography component="div" sx={{ fontSize: 17, fontWeight: 700, color: tokens.text }}>
              {step === "questions" ? "Tell us about the event" : "Review"}
            </Typography>
          </Stack>
          <Typography component="div" sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.25 }}>
            {event.title} · {event.eventTypeLabel} - {step === "questions" ? "answer what you know, skip the rest." : "edit anything before using it."}
          </Typography>
          <IconButton onClick={() => setOpen(false)} disabled={generating} aria-label="Close" sx={{ position: "absolute", right: 12, top: 12 }}><CloseRoundedIcon /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ borderColor: tokens.border, "& .MuiInputBase-multiline": { borderRadius: "14px" } }}>
          {step === "questions" ? (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <TextField fullWidth label="What's it for?" placeholder="e.g. welcome new joiners, quarterly performance check-ins" value={answers.purpose} onChange={text("purpose")} />
              <TextField fullWidth label="Who should attend?" placeholder="e.g. all employees, engineering team, new hires" value={answers.audience} onChange={text("audience")} />
              <TextField fullWidth multiline minRows={3} maxRows={6} label="Agenda" placeholder={"e.g. intro from CEO, team presentations, Q&A"} value={answers.agenda} onChange={text("agenda")} />
              <TextField fullWidth label="What should people prepare or bring?" placeholder="e.g. laptop, self-review filled in" value={answers.preparation} onChange={text("preparation")} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <TextField fullWidth label="Location or meeting link" placeholder="Conference room B / Google Meet" value={answers.location} onChange={text("location")} />
                <TextField fullWidth label="Hosted by" placeholder="e.g. HR team" value={answers.host} onChange={text("host")} />
              </Stack>
              <ChoiceChips
                label="Tone"
                options={["Friendly", "Professional", "Concise"]}
                value={answers.tone[0].toUpperCase() + answers.tone.slice(1)}
                onChange={(v) => setAnswers((a) => ({ ...a, tone: (v || "Friendly").toLowerCase() as Tone }))}
              />
            </Stack>
          ) : (
            <Box sx={{ pt: 0.5 }}>
              {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
              {generating ? (
                <Stack spacing={1.5} sx={{ py: 5, alignItems: "center" }}>
                  <LinearProgress sx={{ width: "60%", borderRadius: 2 }} />
                  <Typography sx={{ fontSize: 13, color: tokens.muted }}>Writing your event description...</Typography>
                </Stack>
              ) : draft ? (
                <TextField fullWidth multiline minRows={10} maxRows={18} value={draft} onChange={(e) => setDraft(e.target.value)} slotProps={{ input: { sx: { fontSize: 13.5, lineHeight: 1.6 } } }} />
              ) : null}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.75 }}>
          {step === "review" && <Button onClick={() => setStep("questions")} disabled={generating} sx={{ color: tokens.muted, mr: "auto" }}>Back</Button>}
          {step === "questions" ? (
            <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => void generate()}>Generate</Button>
          ) : (
            <>
              <Button onClick={() => void generate()} disabled={generating} startIcon={generating ? <CircularProgress size={14} /> : <RefreshRoundedIcon />}>Regenerate</Button>
              <Button variant="contained" onClick={use} disabled={generating || !draft.trim()}>Use this description</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
