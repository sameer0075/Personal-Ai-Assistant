"use client";

import { useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import Alert from "@mui/material/Alert";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { tokens } from "@/lib/theme";
import { CalendarEventSummary, createCalendarEvent, deleteCalendarEvent, listCalendarEvents, syncCalendarToRag } from "@/lib/api/calendar";

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export default function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleLoad() {
    setIsLoading(true);
    setError(null);
    try {
      setEvents(await listCalendarEvents({ maxResults: 15 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      const result = await syncCalendarToRag({ maxResults: 15 });
      setSyncNote(`Indexed ${result.ingested} new, skipped ${result.skipped} already-known (of ${result.found}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync to knowledge base");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      // datetime-local inputs give "YYYY-MM-DDTHH:mm" (no timezone) - treat as local time.
      await createCalendarEvent({
        summary,
        startDateTime: new Date(start).toISOString(),
        endDateTime: new Date(end).toISOString(),
      });
      setSummary("");
      setStart("");
      setEnd("");
      setCreateOpen(false);
      handleLoad();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create event");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(eventId: string) {
    setDeletingId(eventId);
    setError(null);
    try {
      await deleteCalendarEvent(eventId);
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderColor: tokens.border }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-mono)" }}>
            Calendar
          </Typography>
          <Button
            size="small"
            variant="text"
            startIcon={<AddRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setCreateOpen((v) => !v)}
          >
            New event
          </Button>
        </Stack>

        <Collapse in={createOpen}>
          <Stack
            component="form"
            onSubmit={handleCreate}
            spacing={1.25}
            sx={{ p: 1.5, border: `1px solid ${tokens.border}`, borderRadius: 1.5 }}
          >
            <TextField
              label="Title"
              size="small"
              required
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
            <Stack direction="row" spacing={1.25}>
              <TextField
                label="Start"
                type="datetime-local"
                size="small"
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <TextField
                label="End"
                type="datetime-local"
                size="small"
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </Stack>
            <Button
              type="submit"
              variant="contained"
              size="small"
              startIcon={isCreating ? <CircularProgress size={14} /> : <AddRoundedIcon sx={{ fontSize: 16 }} />}
              disabled={isCreating}
              sx={{ alignSelf: "flex-start" }}
            >
              Create
            </Button>
          </Stack>
        </Collapse>

        <Stack direction="row" spacing={1}>
          <IconButton onClick={handleLoad} disabled={isLoading} title="Refresh">
            {isLoading ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
          </IconButton>
          <IconButton onClick={handleSync} disabled={isSyncing} title="Index into knowledge base">
            {isSyncing ? <CircularProgress size={18} /> : <SyncRoundedIcon />}
          </IconButton>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
        {syncNote && <Alert severity="success">{syncNote}</Alert>}

        <Stack spacing={1} divider={<Divider sx={{ borderColor: tokens.border }} />}>
          {events.length === 0 && !isLoading && (
            <Typography variant="body2" color="text.secondary">
              No events loaded yet — hit refresh.
            </Typography>
          )}
          {events.map((event) => (
            <Stack key={event.id} direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
              <Stack spacing={0.25}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {event.summary}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatEventTime(event.start)} → {formatEventTime(event.end)}
                </Typography>
              </Stack>
              <IconButton size="small" onClick={() => handleDelete(event.id)} disabled={deletingId === event.id}>
                {deletingId === event.id ? (
                  <CircularProgress size={14} />
                ) : (
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: tokens.danger }} />
                )}
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}