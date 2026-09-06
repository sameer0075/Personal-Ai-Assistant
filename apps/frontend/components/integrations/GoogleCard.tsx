"use client";

import { useCallback, useEffect, useState } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import EventNoteRoundedIcon from "@mui/icons-material/EventNoteRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { tokens } from "@/lib/theme";
import { GoogleLogo, GmailLogo, CalendarLogo, BrandTile } from "./BrandLogo";
import IntegrationCard, { panelCardSx } from "./IntegrationCard";
import ActionApprovalModal from "../ActionApprovalModal";
import { GmailMessageSummary, listGmailMessages, syncGmailToRag } from "@/lib/api/gmail";
import { CalendarEventSummary, createCalendarEvent, deleteCalendarEvent, listCalendarEvents, syncCalendarToRag } from "@/lib/api/calendar";
import { createEmailDraft, PendingAction } from "@/lib/api/actions";
import { disconnectGoogle, getGoogleAuthUrl, getGoogleStatus, GoogleStatus } from "@/lib/api/google";

function formatEventTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function CapabilityHeader({ icon, title, action }: { icon: React.ReactNode; title: string; action: React.ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
        {icon}
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.text, fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}>
          {title}
        </Typography>
      </Stack>
      {action}
    </Stack>
  );
}

export default function GoogleCard({ onConnectedChange }: { onConnectedChange?: (connected: boolean) => void }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [gmailQuery, setGmailQuery] = useState("");
  const [isGmailLoading, setIsGmailLoading] = useState(false);
  const [isGmailSyncing, setIsGmailSyncing] = useState(false);

  const [events, setEvents] = useState<CalendarEventSummary[]>([]);
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  const [isCalendarSyncing, setIsCalendarSyncing] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus(await getGoogleStatus());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status?.connected) {
      setMessages([]);
      setEvents([]);
      handleLoadGmail();
      handleLoadCalendar();
    }
    onConnectedChange?.(status?.connected ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  async function handleConnect() {
    setIsWorking(true);
    try {
      const { url } = await getGoogleAuthUrl();
      window.location.href = url;
    } catch {
      setIsWorking(false);
    }
  }

  async function handleDisconnect() {
    setIsWorking(true);
    try {
      await disconnectGoogle();
      await refresh();
    } finally {
      setIsWorking(false);
    }
  }

  async function handleLoadGmail() {
    setIsGmailLoading(true);
    setError(null);
    try {
      setMessages(await listGmailMessages({ query: gmailQuery || undefined, maxResults: 15 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setIsGmailLoading(false);
    }
  }

  async function handleSyncGmail() {
    setIsGmailSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      const summary = await syncGmailToRag({ query: gmailQuery || undefined, maxResults: 15 });
      setSyncNote(`Gmail: indexed ${summary.ingested} new, skipped ${summary.skipped} already indexed`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync mail to knowledge base");
    } finally {
      setIsGmailSyncing(false);
    }
  }

  async function handleLoadCalendar() {
    setIsCalendarLoading(true);
    setError(null);
    try {
      setEvents(await listCalendarEvents({ maxResults: 15 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsCalendarLoading(false);
    }
  }

  async function handleSyncCalendar() {
    setIsCalendarSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      const result = await syncCalendarToRag({ maxResults: 15 });
      setSyncNote(`Calendar: indexed ${result.ingested} new, skipped ${result.skipped} already-known (of ${result.found}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync calendar to knowledge base");
    } finally {
      setIsCalendarSyncing(false);
    }
  }

  async function handleDraft(e: React.FormEvent) {
    e.preventDefault();
    setIsDrafting(true);
    setError(null);
    try {
      const draft = await createEmailDraft({ to: composeTo, subject: composeSubject, body: composeBody });
      setPendingAction(draft);
      setReviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare message");
    } finally {
      setIsDrafting(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setError(null);
    try {
      await createCalendarEvent({
        summary,
        startDateTime: new Date(start).toISOString(),
        endDateTime: new Date(end).toISOString(),
      });
      setSummary("");
      setStart("");
      setEnd("");
      setCreateOpen(false);
      handleLoadCalendar();
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

  function handleDecided(updated: PendingAction) {
    setReviewOpen(false);
    setPendingAction(null);
    if (updated.status === "approved") {
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposeOpen(false);
    }
  }

  return (
    <>
      <IntegrationCard
      name="Google"
      tagline="Gmail and Calendar access for reading, drafting, and syncing your day."
      tile={
        <BrandTile bg={tokens.panelRaised}>
          <GoogleLogo />
        </BrandTile>
      }
      connected={status?.connected ?? false}
      statusLabel={status?.googleEmail ?? null}
      loading={isLoading}
      working={isWorking}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      connectLabel="Connect Google"
      body={
        <>
          <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", gap: 2 }} divider={<Divider orientation="vertical" flexItem />}>
            <Stack spacing={1.75} sx={{ flex: "1 1 340px", minWidth: 0 }}>
              <CapabilityHeader
                icon={<GmailLogo size={18} />}
                title="Gmail"
                action={
                  <Button size="small" variant="text" startIcon={<EditRoundedIcon sx={{ fontSize: 15 }} />}
                    onClick={() => setComposeOpen((v) => !v)}>
                    Compose
                  </Button>
                }
              />

              <Collapse in={composeOpen}>
                <Stack
                  component="form"
                  onSubmit={handleDraft}
                  spacing={1.25}
                  sx={{ p: 1.5, border: `1px solid ${tokens.border}`, borderRadius: 2, bgcolor: tokens.panelRaised, mb: 0.5 }}
                >
                  <TextField label="To" type="email" required value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
                  <TextField label="Subject" required value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
                  <TextField
                    label="Body"
                    required
                    multiline
                    minRows={3}
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Drafts open a review step before anything is sent.
                  </Typography>
                  <Button
                    type="submit"
                    variant="contained"
                    size="small"
                    startIcon={isDrafting ? <CircularProgress size={14} /> : <SendRoundedIcon sx={{ fontSize: 15 }} />}
                    disabled={isDrafting}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Review &amp; send
                  </Button>
                </Stack>
              </Collapse>

              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  placeholder="Search, e.g. is:unread from:someone@example.com"
                  value={gmailQuery}
                  onChange={(e) => setGmailQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLoadGmail()}
                />
                <Tooltip title="Refresh messages">
                  <IconButton onClick={handleLoadGmail} disabled={isGmailLoading}>
                    {isGmailLoading ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Index into knowledge base">
                  <IconButton onClick={handleSyncGmail} disabled={isGmailSyncing}>
                    {isGmailSyncing ? <CircularProgress size={18} /> : <SyncRoundedIcon />}
                  </IconButton>
                </Tooltip>
              </Stack>

              <Stack spacing={1} divider={<Divider sx={{ borderColor: tokens.border }} />}>
                {messages.length === 0 && !isGmailLoading && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                    No messages loaded yet — hit refresh.
                  </Typography>
                )}
                {messages.map((m) => (
                  <Stack key={m.id} spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
                      {m.subject}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.from} · {m.date}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.8 }}>
                      {m.snippet}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>

            <Stack spacing={1.75} sx={{ flex: "1 1 340px", minWidth: 0 }}>
              <CapabilityHeader
                icon={<CalendarLogo size={18} />}
                title="Google Calendar"
                action={
                  <Button size="small" variant="text" startIcon={<AddRoundedIcon sx={{ fontSize: 15 }} />}
                    onClick={() => setCreateOpen((v) => !v)}>
                    New event
                  </Button>
                }
              />

              <Collapse in={createOpen}>
                <Stack
                  component="form"
                  onSubmit={handleCreate}
                  spacing={1.25}
                  sx={{ p: 1.5, border: `1px solid ${tokens.border}`, borderRadius: 2, bgcolor: tokens.panelRaised, mb: 0.5 }}
                >
                  <TextField label="Title" required value={summary} onChange={(e) => setSummary(e.target.value)} />
                  <Stack direction="row" spacing={1.25}>
                    <TextField
                      label="Start"
                      type="datetime-local"
                      required
                      fullWidth
                      slotProps={{ inputLabel: { shrink: true } }}
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                    <TextField
                      label="End"
                      type="datetime-local"
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
                    startIcon={isCreating ? <CircularProgress size={14} /> : <AddRoundedIcon sx={{ fontSize: 15 }} />}
                    disabled={isCreating}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Create
                  </Button>
                </Stack>
              </Collapse>

              <Stack direction="row" spacing={1}>
                <IconButton onClick={handleLoadCalendar} disabled={isCalendarLoading}>
                  {isCalendarLoading ? <CircularProgress size={18} /> : <RefreshRoundedIcon />}
                </IconButton>
                <IconButton onClick={handleSyncCalendar} disabled={isCalendarSyncing}>
                  {isCalendarSyncing ? <CircularProgress size={18} /> : <SyncRoundedIcon />}
                </IconButton>
                <Typography variant="caption" sx={{ color: tokens.mutedDim, alignSelf: "center" }}>
                  Load &amp; index events
                </Typography>
              </Stack>

              <Stack spacing={1} divider={<Divider sx={{ borderColor: tokens.border }} />}>
                {events.length === 0 && !isCalendarLoading && (
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                    No events loaded yet — hit refresh.
                  </Typography>
                )}
                {events.map((event) => (
                  <Stack key={event.id} direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                    <Stack spacing={0.25} sx={{ pr: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
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
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: tokens.danger }} />
                      )}
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Stack>

          {(error || syncNote) && (
            <Stack sx={panelCardSx}>
              {error && <Alert severity="error" sx={{ p: 1, fontSize: 12.5 }}>{error}</Alert>}
              {syncNote && <Alert severity="success" sx={{ p: 1, fontSize: 12.5 }}>{syncNote}</Alert>}
            </Stack>
          )}
        </>
}
      />
      <ActionApprovalModal
        action={pendingAction}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onDecided={handleDecided}
      />
    </>
  );
}