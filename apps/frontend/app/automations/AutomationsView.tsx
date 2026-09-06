"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Switch from "@mui/material/Switch";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import AddCircleOutlineRoundedIcon from "@mui/icons-material/AddCircleOutlineRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import RepeatRoundedIcon from "@mui/icons-material/RepeatRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";

import Sidebar from "@/components/Sidebar";
import { tokens } from "@/lib/theme";
import {
  listAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  runAutomation,
  browserTimezone,
  toUtcIso,
  type ScheduledTask,
  type ScheduleKind,
  type DeliveryMode,
  type DeliveryDefinition,
} from "@/lib/api/automations";

const DEFAULT_CRON_PRESETS = [
  { expr: "0 9 * * 1-5", label: "Weekdays 9am" },
  { expr: "0 18 * * *", label: "Every day 6pm" },
  { expr: "0 8 * * 1", label: "Mondays 8am" },
  { expr: "*/30 * * * *", label: "Every 30 minutes" },
];

const KIND_META: Record<ScheduleKind, { label: string; icon: typeof EventRoundedIcon }> = {
  once: { label: "One-shot", icon: EventRoundedIcon },
  interval: { label: "Interval", icon: ReplayRoundedIcon },
  cron: { label: "Cron", icon: RepeatRoundedIcon },
};

function formatWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function kindChip(task: ScheduledTask) {
  const meta = KIND_META[task.scheduleKind];
  const label =
    task.scheduleKind === "interval"
      ? `every ${task.intervalMinutes} min`
      : task.scheduleKind === "cron"
        ? task.cronExpr ?? "cron"
        : "one-shot";
  return (
    <Chip
      size="small"
      icon={<meta.icon sx={{ fontSize: 13 }} />}
      label={label}
      sx={{
        height: 20,
        fontSize: 10.5,
        bgcolor: task.enabled ? tokens.accentDim : tokens.panelRaised,
        color: task.enabled ? tokens.accentBright : tokens.muted,
        "& .MuiChip-icon": { fontSize: 13, color: task.enabled ? tokens.accent : tokens.mutedDim },
      }}
    />
  );
}

function deliveryChip(task: ScheduledTask) {
  if (task.deliveryMode === "chat") return null;
  return (
    <Chip
      size="small"
      icon={<MailRoundedIcon sx={{ fontSize: 13 }} />}
      label={task.deliveryMode === "both" ? "chat + email" : "email"}
      sx={{
        height: 20,
        fontSize: 10.5,
        bgcolor: tokens.panelRaised,
        color: tokens.muted,
        "& .MuiChip-icon": { fontSize: 13, color: tokens.accent },
      }}
    />
  );
}

interface TaskCardProps {
  task: ScheduledTask;
  onChanged: () => void;
}

function TaskCard({ task, onChanged }: TaskCardProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function handle(action: () => Promise<unknown>, busyKey: string) {
    setBusy(busyKey);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const nextRun = task.enabled ? formatWhen(task.triggerAt) : null;
  const lastRun = formatWhen(task.lastRunAt);
  const prelude = task.enabled
    ? nextRun
      ? `Next run ${nextRun}`
      : "No next run scheduled"
    : "Paused";

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${task.enabled ? tokens.borderStrong : tokens.border}`,
        bgcolor: tokens.panel,
        px: 1.75,
        py: 1.5,
        opacity: task.enabled ? 1 : 0.72,
        transition: "border-color 0.15s ease, opacity 0.15s ease",
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 600,
                color: tokens.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {task.title}
            </Typography>
            {kindChip(task)}
            {deliveryChip(task)}
          </Stack>
          <Typography
            onClick={() => setExpanded((v) => !v)}
            sx={{
              fontSize: 12,
              color: task.enabled ? tokens.mutedDim : tokens.muted,
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
            }}
          >
            {prelude}
            {lastRun ? ` · last run ${lastRun}` : ""}
            {task.runCount > 0 ? ` · ran ${task.runCount}x` : ""}
          </Typography>
        </Stack>

        <Tooltip title={task.enabled ? "Pause" : "Resume"}>
          <Switch
            size="small"
            checked={task.enabled}
            disabled={busy !== null}
            onChange={(e) => handle(() => updateAutomation(task.id, { enabled: e.target.checked }), "toggle")}
            color="primary"
            sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: tokens.accent } }}
          />
        </Tooltip>
        <Tooltip title="Run now">
          <IconButton
            size="small"
            disabled={busy !== null}
            onClick={() => handle(() => runAutomation(task.id), "run")}
            sx={{ color: tokens.accent, "&:hover": { bgcolor: tokens.accentDim } }}
          >
            {busy === "run" ? (
              <CircularProgress size={15} sx={{ color: tokens.accent }} />
            ) : (
              <PlayArrowRoundedIcon sx={{ fontSize: 17 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton
            size="small"
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm(`Delete "${task.title}"? It will no longer run.`)) {
                handle(() => deleteAutomation(task.id), "delete");
              }
            }}
            sx={{ color: tokens.mutedDim, "&:hover": { color: tokens.danger } }}
          >
            {busy === "delete" ? (
              <CircularProgress size={14} sx={{ color: tokens.danger }} />
            ) : (
              <DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} />
            )}
          </IconButton>
        </Tooltip>
      </Stack>

      {expanded && (
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          <Typography
            sx={{
              fontSize: 12.5,
              color: tokens.muted,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {task.prompt}
          </Typography>
          <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
            timezone {task.timezone}
            {task.deliverToSessionId ? " · pinned to a chat" : " · delivers to most recent chat"}
          </Typography>
          {task.deliveryMode !== "chat" && (
            <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
              email → {task.emailTo ?? "your account email"} · subject “{task.emailSubject ?? `[Automation: ${task.title}]`}”
            </Typography>
          )}
        </Stack>
      )}

      {expanded && task.prompt.length > 40 && (
        <Stack
          direction="row"
          onClick={() => setExpanded((v) => !v)}
          sx={{ alignItems: "center", gap: 0.25, mt: 1, cursor: "pointer", color: tokens.accent }}
        >
          <ExpandLessRoundedIcon sx={{ fontSize: 14 }} />
          <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>Show less</Typography>
        </Stack>
      )}

      {error && <Typography sx={{ mt: 1, fontSize: 12, color: tokens.danger }}>{error}</Typography>}
    </Box>
  );
}

function CreateForm({ onCreated }: { onCreated: (task: ScheduledTask) => void }) {
  const [kind, setKind] = useState<ScheduleKind>("once");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [atOnce, setAtOnce] = useState("");
  const [atInterval, setAtInterval] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [cron, setCron] = useState(DEFAULT_CRON_PRESETS[0].expr);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("chat");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsEmail = deliveryMode !== "chat";

  const minDatetime = useMemo(() => {
    const local = new Date(Date.now() + 60_000);
    const offset = local.getTimezoneOffset();
    return new Date(local.getTime() - offset * 60_000).toISOString().slice(0, 16);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Give the automation a title");
    if (!prompt.trim()) return setError("What should the assistant do when it fires?");

    let schedule: Parameters<typeof createAutomation>[0]["schedule"];
    if (kind === "once") {
      const at = toUtcIso(atOnce);
      if (!at) return setError("Choose a date and time for the one-shot run");
      schedule = { kind: "once", at, timezone: "UTC" };
    } else if (kind === "interval") {
      const minutes = Number(intervalMinutes);
      if (!Number.isInteger(minutes) || minutes < 1) return setError("Interval must be a whole number of minutes ≥ 1");
      schedule = { kind: "interval", intervalMinutes: minutes, timezone: "UTC" };
      const at = toUtcIso(atInterval);
      if (at) schedule.at = at;
    } else {
      if (!cron.trim()) return setError("Enter a cron expression");
      schedule = { kind: "cron", cron: cron.trim(), timezone: browserTimezone() };
    }

    setSubmitting(true);
    try {
      const delivery: DeliveryDefinition = { mode: deliveryMode };
      if (needsEmail) {
        if (emailTo.trim()) delivery.emailTo = emailTo.trim();
        if (emailSubject.trim()) delivery.emailSubject = emailSubject.trim();
      }
      const created = await createAutomation({
        title: title.trim(),
        prompt: prompt.trim(),
        schedule,
        delivery,
      });
      setTitle("");
      setPrompt("");
      setAtOnce("");
      setAtInterval("");
      setEmailTo("");
      setEmailSubject("");
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create automation");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      component="form"
      onSubmit={submit}
      sx={{
        borderRadius: 3,
        border: `1.5px solid ${tokens.accent}`,
        bgcolor: tokens.panel,
        boxShadow: `0 2px 16px ${tokens.accentGlow}`,
        px: 2.5,
        py: 2.5,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
        <AddCircleOutlineRoundedIcon sx={{ fontSize: 18, color: tokens.accent }} />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>New automation</Typography>
        <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
          the assistant runs the prompt and posts the answer to your chat
        </Typography>
      </Stack>

      <Stack spacing={2}>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Interview prep reminder"
          size="small"
          fullWidth
        />
        <TextField
          label="Prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. I have a Senior Fullstack interview at 1pm. Give me a pre-interview checklist and 3 likely questions."
          size="small"
          multiline
          minRows={2}
          maxRows={5}
          fullWidth
        />

        <TextField
          select
          label="Deliver to"
          value={deliveryMode}
          onChange={(e) => setDeliveryMode(e.target.value as DeliveryMode)}
          size="small"
          sx={{ width: 200 }}
        >
          <MenuItem value="chat">Chat only</MenuItem>
          <MenuItem value="email">Email only</MenuItem>
          <MenuItem value="both">Chat + email</MenuItem>
        </TextField>

        {needsEmail && (
          <Stack spacing={2}>
            <TextField
              label="Email to"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="you@example.com — leave blank to email your account"
              type="email"
              size="small"
              fullWidth
            />
            <TextField
              label="Email subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder={`Defaults to “[Automation: ${title || "title"}]”`}
              size="small"
              fullWidth
            />
            <Typography sx={{ fontSize: 11, color: tokens.mutedDim }}>
              Optional. Blank = your logged-in account email. Requires your Google account to be connected — it sends from your Gmail.
            </Typography>
          </Stack>
        )}

        <TextField
          select
          label="Recurrence"
          value={kind}
          onChange={(e) => setKind(e.target.value as ScheduleKind)}
          size="small"
          sx={{ width: 200 }}
        >
          <MenuItem value="once">One-shot</MenuItem>
          <MenuItem value="interval">Every N minutes</MenuItem>
          <MenuItem value="cron">Cron expression</MenuItem>
        </TextField>

        {kind === "once" && (
          <TextField
            label="Run at"
            type="datetime-local"
            value={atOnce}
            onChange={(e) => setAtOnce(e.target.value)}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { min: minDatetime }, inputLabel: { shrink: true } }}
          />
        )}

        {kind === "interval" && (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Every (minutes)"
              type="number"
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(e.target.value)}
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              size="small"
              sx={{ width: 180 }}
            />
            <TextField
              label="First run (optional)"
              type="datetime-local"
              value={atInterval}
              onChange={(e) => setAtInterval(e.target.value)}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Stack>
        )}

        {kind === "cron" && (
          <Stack spacing={1}>
            <TextField
              label="Cron expression (minute hour day month weekday)"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 9 * * 1-5"
              size="small"
              fullWidth
              sx={{ "& input": { fontFamily: "var(--font-mono)" } }}
            />
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              {DEFAULT_CRON_PRESETS.map((preset) => (
                <Chip
                  key={preset.expr}
                  size="small"
                  label={`${preset.label} — ${preset.expr}`}
                  onClick={() => setCron(preset.expr)}
                  sx={{
                    bgcolor: cron === preset.expr ? tokens.accentDim : tokens.panelRaised,
                    color: cron === preset.expr ? tokens.accentBright : tokens.muted,
                    fontSize: 11,
                    "&:hover": { bgcolor: tokens.accentDim },
                  }}
                />
              ))}
            </Stack>
            <Typography sx={{ fontSize: 11, color: tokens.mutedDim }}>
              Fires in your local timezone ({browserTimezone()}).
            </Typography>
          </Stack>
        )}

        {error && <Typography sx={{ fontSize: 12, color: tokens.danger }}>{error}</Typography>}

        <Stack direction="row" spacing={1.5} sx={{ justifyContent: "flex-end" }}>
          <Button
            type="submit"
            disabled={submitting}
            size="small"
            sx={{
              bgcolor: tokens.accent,
              color: "#fff",
              px: 2.5,
              "&:hover": { bgcolor: tokens.accentBright },
            }}
          >
            {submitting ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Create automation"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function AutomationsView() {
  const [tasks, setTasks] = useState<ScheduledTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    listAutomations()
      .then((data) => {
        setTasks(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load automations");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enabledCount = tasks?.filter((t) => t.enabled).length ?? 0;

  return (
    <Box sx={{ display: "flex", height: "100dvh", bgcolor: tokens.bg }}>
      <Sidebar />

      <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <Stack
          direction="row"
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${tokens.border}`,
            bgcolor: tokens.panelGlass,
            backdropFilter: "blur(10px)",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              bgcolor: tokens.accentDim,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ScheduleRoundedIcon sx={{ fontSize: 16, color: tokens.accent }} />
          </Box>
          <Stack spacing={0} sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.text }}>Automations</Typography>
            <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
              scheduled tasks · answers land in chat
            </Typography>
          </Stack>
          <Button
            size="small"
            onClick={() => setShowForm((v) => !v)}
            sx={{
              bgcolor: showForm ? tokens.panelRaised : tokens.accent,
              color: showForm ? tokens.muted : "#fff",
              "&:hover": { bgcolor: showForm ? tokens.panelRaised : tokens.accentBright },
            }}
          >
            {showForm ? <CloseRoundedIcon sx={{ fontSize: 15, mr: 0.5 }} /> : <AddCircleOutlineRoundedIcon sx={{ fontSize: 15, mr: 0.5 }} />}
            {showForm ? "Close" : "New automation"}
          </Button>
        </Stack>

        <Box sx={{ maxWidth: 720, mx: "auto", px: 3, py: 4 }}>
          {error && (
            <Stack sx={{ alignItems: "center", py: 6 }}>
              <Typography sx={{ fontSize: 13, color: tokens.danger }}>{error}</Typography>
            </Stack>
          )}

          {showForm && (
            <Box sx={{ mb: 3 }}>
              <CreateForm
                onCreated={() => {
                  setShowForm(false);
                  load();
                }}
              />
            </Box>
          )}

          {tasks === null ? (
            <Stack sx={{ alignItems: "center", py: 8 }}>
              <CircularProgress size={26} sx={{ color: tokens.accent }} />
            </Stack>
          ) : tasks.length === 0 ? (
            <Stack sx={{ alignItems: "center", gap: 1, py: 10 }} spacing={1}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  bgcolor: tokens.panelRaised,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ScheduleRoundedIcon sx={{ fontSize: 26, color: tokens.mutedDim }} />
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
                No automations yet
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: tokens.muted, textAlign: "center", maxWidth: 380 }}>
                Create a one-shot ("remind me Tuesday 3pm to call the bank"), a repeating interval, or a cron
                ("daily 9am prep brief"). Results are delivered right into your chat.
              </Typography>
              <Button
                size="small"
                onClick={() => setShowForm(true)}
                sx={{ mt: 1, bgcolor: tokens.accent, color: "#fff", "&:hover": { bgcolor: tokens.accentBright } }}
              >
                Create your first automation
              </Button>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)", px: 0.5 }}>
                {tasks.length} automation{tasks.length === 1 ? "" : "s"} · {enabledCount} active
              </Typography>
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} onChanged={load} />
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}