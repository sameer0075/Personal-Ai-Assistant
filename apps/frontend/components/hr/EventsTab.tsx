"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import GroupAddRoundedIcon from "@mui/icons-material/GroupAddRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import Button from "@mui/material/Button";
import { createHrEvent, deleteHrEvent, updateHrEvent, type HrEmployee, type HrEvent, type HrEventInput } from "@/lib/api/hr";
import type { PendingAction } from "@/lib/api/actions";
import { tokens } from "@/lib/theme";
import { EmptyState, FormDialog, RecordRow, StatusChip, Toolbar, full, orNull, pasteKeepingLines } from "./hrUi";
import EventDescriptionGenerator from "./EventDescriptionGenerator";
import { EventInviteDialog, InviteApprovalDialog } from "./EventInvite";

const EVENT_TYPES: Record<string, string> = {
  interview: "Interview",
  onboarding: "Onboarding",
  review: "Performance review",
  training: "Training",
  team: "Team event",
  holiday: "Holiday",
  general: "General",
};

/** ISO timestamp -> value for a datetime-local input, in the viewer's time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const EMPTY_FORM = { title: "", eventType: "general", startsAt: "", endsAt: "", description: "" };

export default function EventsTab({ events, setEvents, employees, onError }: {
  events: HrEvent[];
  employees: HrEmployee[];
  setEvents: (update: (current: HrEvent[]) => HrEvent[]) => void;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<HrEvent | "new" | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [inviteFor, setInviteFor] = useState<HrEvent | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);

  const patchEvent = (id: string, patch: Partial<HrEvent>) => setEvents((current) => current.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  function onInviteRequested(event: HrEvent, action: PendingAction) {
    patchEvent(event.id, { inviteActionId: action.id, inviteStatus: "pending", inviteResult: null });
    setInviteFor(null);
    setApprovalId(action.id);
  }

  function onInviteDecided(action: PendingAction) {
    const event = events.find((e) => e.inviteActionId === action.id);
    if (!event) return;
    patchEvent(event.id, {
      inviteStatus: action.status === "pending" ? "pending" : action.status,
      inviteResult: (action.result as HrEvent["inviteResult"]) ?? null,
      calendarEventId: (action.result as { calendarEventId?: string } | null)?.calendarEventId ?? event.calendarEventId,
    });
  }

  const now = Date.now();
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => !q || [e.title, e.description, EVENT_TYPES[e.eventType]].some((v) => v?.toLowerCase().includes(q)));
  }, [events, search]);
  const upcoming = visible.filter((e) => Date.parse(e.endsAt ?? e.startsAt) >= now);
  const past = visible.filter((e) => Date.parse(e.endsAt ?? e.startsAt) < now).reverse();

  function openEditor(event: HrEvent | "new") {
    setEditing(event);
    setForm(event === "new" ? EMPTY_FORM : {
      title: event.title,
      eventType: EVENT_TYPES[event.eventType] ? event.eventType : "general",
      startsAt: toLocalInput(event.startsAt),
      endsAt: toLocalInput(event.endsAt),
      description: event.description ?? "",
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    const input: HrEventInput = {
      title: form.title.trim(),
      eventType: form.eventType,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      description: orNull(form.description),
    };
    try {
      const saved = editing === "new" ? await createHrEvent(input) : await updateHrEvent(editing.id, input);
      setEvents((current) => (current.some((e) => e.id === saved.id) ? current.map((e) => (e.id === saved.id ? saved : e)) : [...current, saved])
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)));
      setEditing(null);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save event");
    } finally {
      setBusy(false);
    }
  }

  async function remove(event: HrEvent) {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    try {
      await deleteHrEvent(event.id);
      setEvents((current) => current.filter((e) => e.id !== event.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete event");
    }
  }

  const set = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const current = editing && editing !== "new" ? editing : null;
  const endBeforeStart = Boolean(form.startsAt && form.endsAt && form.endsAt < form.startsAt);

  function renderList(items: HrEvent[], label: string) {
    if (!items.length) return null;
    return (
      <Stack spacing={1}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: tokens.mutedDim, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</Typography>
        {items.map((event) => {
          const start = new Date(event.startsAt);
          return (
            <RecordRow
              key={event.id}
              onClick={() => openEditor(event)}
              leading={
                <Box sx={{ width: 40, textAlign: "center", borderRadius: 1.5, bgcolor: tokens.accentDim, color: tokens.accentBright, py: 0.4 }}>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", lineHeight: 1.2 }}>{start.toLocaleString(undefined, { month: "short" })}</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.1 }}>{start.getDate()}</Typography>
                </Box>
              }
              title={event.title}
              subtitle={[
                start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) + (event.endsAt ? ` - ${new Date(event.endsAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""),
                event.description,
              ].filter(Boolean).join(" · ")}
              meta={<>
                {event.inviteStatus === "pending" && (
                  <Button size="small" startIcon={<HourglassTopRoundedIcon sx={{ fontSize: 15 }} />} onClick={(e) => { e.stopPropagation(); setApprovalId(event.inviteActionId); }} sx={{ bgcolor: "#fbf1dd", color: "#8a5a0b", borderRadius: 999, px: 1.25, py: 0.1, fontSize: 11.5, "&:hover": { bgcolor: "#f6e6c4" } }}>
                    Awaiting approval
                  </Button>
                )}
                {event.inviteStatus === "approved" && <StatusChip label={`Invited · ${event.inviteResult?.recipients ?? 0}`} tone="green" />}
                <StatusChip label={EVENT_TYPES[event.eventType] ?? event.eventType} tone="purple" />
              </>}
              actions={<>
                {event.inviteStatus === "pending" && (
                  <Tooltip title="Awaiting approval - review"><IconButton size="small" sx={{ display: { sm: "none" } }} onClick={() => setApprovalId(event.inviteActionId)}><HourglassTopRoundedIcon sx={{ fontSize: 18, color: "#8a5a0b" }} /></IconButton></Tooltip>
                )}
                {event.inviteStatus !== "pending" && event.inviteStatus !== "approved" && Date.parse(event.endsAt ?? event.startsAt) >= now && (
                  <Tooltip title="Invite employees (calendar + email)"><IconButton size="small" onClick={() => setInviteFor(event)}><GroupAddRoundedIcon sx={{ fontSize: 18, color: tokens.accent }} /></IconButton></Tooltip>
                )}
                <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditor(event)}><EditRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" onClick={() => void remove(event)}><DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              </>}
            />
          );
        })}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Toolbar search={search} onSearch={setSearch} placeholder="Search events" actionLabel="Schedule event" onAction={() => openEditor("new")} />

      {events.length === 0 ? (
        <EmptyState icon={<CalendarMonthRoundedIcon />} title="No HR events scheduled" hint="Add interviews, onboarding sessions, reviews, trainings, and team events." />
      ) : visible.length === 0 ? (
        <EmptyState icon={<CalendarMonthRoundedIcon />} title="No matches" hint={`No events match "${search}".`} />
      ) : (
        <Stack spacing={2.5}>
          {renderList(upcoming, "Upcoming")}
          {renderList(past, "Past")}
        </Stack>
      )}

      <FormDialog
        open={editing !== null}
        title={current ? `Edit ${current.title}` : "Schedule an HR event"}
        submitLabel={current ? "Save changes" : "Schedule"}
        busy={busy}
        canSubmit={form.title.trim().length > 0 && Boolean(form.startsAt) && !endBeforeStart}
        onClose={() => setEditing(null)}
        onSubmit={() => void save()}
      >
        <TextField sx={full} size="small" label="Title" required autoFocus value={form.title} onChange={set("title")} />
        <TextField sx={full} size="small" select label="Type" value={form.eventType} onChange={set("eventType")}>
          {Object.entries(EVENT_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField size="small" type="datetime-local" label="Starts" required value={form.startsAt} onChange={set("startsAt")} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="datetime-local" label="Ends" value={form.endsAt} onChange={set("endsAt")} error={endBeforeStart} helperText={endBeforeStart ? "Ends before it starts" : undefined} slotProps={{ inputLabel: { shrink: true } }} />
        <Stack direction="row" sx={{ ...full, alignItems: "center", justifyContent: "space-between", gap: 1, mt: 0.5 }}>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>Description</Typography>
            <Typography sx={{ fontSize: 11.5, color: tokens.muted }}>Shown in the calendar invite and email.</Typography>
          </Box>
          <EventDescriptionGenerator
            event={{ title: form.title, eventTypeLabel: EVENT_TYPES[form.eventType] ?? form.eventType }}
            hasDescription={form.description.trim().length > 0}
            onUse={(description) => setForm((f) => ({ ...f, description }))}
          />
        </Stack>
        <TextField
          sx={full}
          size="small"
          multiline
          minRows={6}
          maxRows={14}
          placeholder="What it's about, agenda, what to bring..."
          value={form.description}
          onChange={set("description")}
          onPaste={pasteKeepingLines((update) => setForm((f) => ({ ...f, description: update(f.description) })))}
          slotProps={{ htmlInput: { "aria-label": "Description" }, input: { sx: { fontSize: 13.5, lineHeight: 1.6 } } }}
        />
      </FormDialog>

      {inviteFor && (
        <EventInviteDialog
          event={inviteFor}
          employees={employees}
          open
          onClose={() => setInviteFor(null)}
          onRequested={(action) => onInviteRequested(inviteFor, action)}
        />
      )}
      <InviteApprovalDialog actionId={approvalId} open={approvalId !== null} onClose={() => setApprovalId(null)} onDecided={onInviteDecided} />
    </Stack>
  );
}
