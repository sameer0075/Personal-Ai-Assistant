"use client";

import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import VerifiedUserRoundedIcon from "@mui/icons-material/VerifiedUserRounded";
import { approveAction, listPendingActions, rejectAction, type HrEventInvitePayload, type PendingAction } from "@/lib/api/actions";
import { requestHrEventInvite, type HrEmployee, type HrEvent } from "@/lib/api/hr";
import { tokens } from "@/lib/theme";

const dialogPaper = { paper: { sx: { borderRadius: 3 } } };
const multilineSx = { "& .MuiInputBase-multiline": { borderRadius: "14px" } };

export function formatEventWhen(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const day = start.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day}, ${time(start)}${endsAt ? ` - ${time(new Date(endsAt))}` : ""}`;
}

function defaultEmail(event: HrEvent, withCalendar: boolean) {
  const when = formatEventWhen(event.startsAt, event.endsAt);
  const subject = `Invitation: ${event.title} - ${new Date(event.startsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
  const body = [
    "Hi {name},",
    "",
    `You're invited to ${event.title}.`,
    "",
    `When: ${when}`,
    ...(event.description ? ["", event.description] : []),
    "",
    withCalendar ? "A calendar invitation has been sent to you as well - please accept it so it shows in your calendar." : "Please add it to your calendar.",
    "",
    "Best regards,",
    "HR Team",
  ].join("\n");
  return { subject, body };
}

function DialogHeader({ title, subtitle, onClose, disabled }: { title: string; subtitle: string; onClose: () => void; disabled?: boolean }) {
  return (
    <DialogTitle sx={{ pr: 6 }}>
      <Typography component="div" sx={{ fontSize: 17, fontWeight: 700, color: tokens.text }}>{title}</Typography>
      <Typography component="div" sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.25 }}>{subtitle}</Typography>
      <IconButton onClick={onClose} disabled={disabled} aria-label="Close" sx={{ position: "absolute", right: 12, top: 12 }}><CloseRoundedIcon /></IconButton>
    </DialogTitle>
  );
}

/**
 * Step 1: choose who gets invited and what they receive. Submitting only
 * creates an approval request - nothing is sent from here.
 */
export function EventInviteDialog({ event, employees, open, onClose, onRequested }: {
  event: HrEvent;
  employees: HrEmployee[];
  open: boolean;
  onClose: () => void;
  onRequested: (action: PendingAction) => void;
}) {
  // Current staff only; former employees and candidates are never invited.
  const people = useMemo(
    () => employees.filter((e) => e.status === "active" || e.status === "on_leave").sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees]
  );
  const invitable = people.filter((e) => e.email);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addToCalendar, setAddToCalendar] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(people.filter((e) => e.status === "active" && e.email).map((e) => e.id)));
    const email = defaultEmail(event, true);
    setSubject(email.subject);
    setBody(email.body);
    setAddToCalendar(true);
    setSendEmail(true);
    setError(null);
  }, [open, event, people]);

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = invitable.length > 0 && invitable.every((e) => selected.has(e.id));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const action = await requestHrEventInvite(event.id, {
        employeeIds: [...selected],
        addToCalendar,
        sendEmail,
        emailSubject: sendEmail ? subject.trim() : undefined,
        emailBody: sendEmail ? body.trim() : undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      onRequested(action);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not prepare the invitation");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = selected.size > 0 && (addToCalendar || sendEmail) && (!sendEmail || (subject.trim() && body.trim()));

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={dialogPaper}>
      <DialogHeader title="Invite employees" subtitle={`${event.title} · ${formatEventWhen(event.startsAt, event.endsAt)}`} onClose={onClose} disabled={busy} />
      <DialogContent dividers sx={{ borderColor: tokens.border, ...multilineSx }}>
        <Stack spacing={2.25}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box>
            <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.text }}>Recipients · {selected.size} selected</Typography>
              {invitable.length > 0 && (
                <Button size="small" onClick={() => setSelected(allSelected ? new Set() : new Set(invitable.map((e) => e.id)))}>
                  {allSelected ? "Clear" : "Select all"}
                </Button>
              )}
            </Stack>
            {people.length === 0 ? (
              <Alert severity="info">There are no active employees in People yet.</Alert>
            ) : (
              <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 2, maxHeight: 230, overflowY: "auto" }}>
                {people.map((person) => (
                  <Stack
                    key={person.id}
                    direction="row"
                    onClick={() => person.email && toggle(person.id)}
                    sx={{ alignItems: "center", gap: 1, px: 1, py: 0.5, borderBottom: `1px solid ${tokens.border}`, "&:last-child": { borderBottom: 0 }, cursor: person.email ? "pointer" : "default", opacity: person.email ? 1 : 0.55 }}
                  >
                    <Checkbox size="small" checked={selected.has(person.id)} disabled={!person.email} tabIndex={-1} />
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: tokens.accentDim, color: tokens.accentBright }}>{person.fullName[0]?.toUpperCase()}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>{person.fullName}</Typography>
                      <Typography sx={{ fontSize: 11.5, color: tokens.muted }}>{person.email ?? "No email address - can't be invited"}</Typography>
                    </Box>
                    {person.status === "on_leave" && <Chip size="small" label="On leave" sx={{ height: 20, fontSize: 10.5 }} />}
                  </Stack>
                ))}
              </Box>
            )}
          </Box>

          <Stack spacing={0.25}>
            <FormControlLabel
              control={<Checkbox checked={addToCalendar} onChange={(e) => setAddToCalendar(e.target.checked)} />}
              label={<Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>Add to their Google Calendar</Typography><Typography sx={{ fontSize: 11.5, color: tokens.muted }}>Google sends each person a calendar invitation they can accept.</Typography></Box>}
            />
            <FormControlLabel
              control={<Checkbox checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />}
              label={<Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>Send an email</Typography><Typography sx={{ fontSize: 11.5, color: tokens.muted }}>One personal email per person from your Work Gmail.</Typography></Box>}
            />
          </Stack>

          {sendEmail && (
            <Stack spacing={1.5}>
              <TextField fullWidth label="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <TextField fullWidth multiline minRows={7} maxRows={14} label="Message" value={body} onChange={(e) => setBody(e.target.value)} helperText="{name} is replaced with each person's first name." />
            </Stack>
          )}

          <Alert icon={<VerifiedUserRoundedIcon fontSize="small" />} severity="info" sx={{ fontSize: 12.5 }}>
            Nothing is sent yet. You'll review and approve this before any invite or email goes out.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.75 }}>
        <Button onClick={onClose} disabled={busy} sx={{ color: tokens.muted }}>Cancel</Button>
        <Button variant="contained" onClick={() => void submit()} disabled={busy || !canSubmit} startIcon={busy ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : undefined}>
          Continue to approval
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Step 2 - the human approval: a final summary of exactly what goes out,
 * with wording still editable. Approving sends; rejecting discards.
 */
export function InviteApprovalDialog({ actionId, open, onClose, onDecided }: {
  actionId: string | null;
  open: boolean;
  onClose: () => void;
  onDecided: (action: PendingAction) => void;
}) {
  const [action, setAction] = useState<PendingAction | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PendingAction | null>(null);

  useEffect(() => {
    if (!open || !actionId) return;
    setAction(null);
    setDone(null);
    setError(null);
    setLoading(true);
    listPendingActions()
      .then((actions) => {
        const found = actions.find((a) => a.id === actionId) ?? null;
        if (!found) setError("This invitation is no longer waiting for approval.");
        setAction(found);
        const payload = found?.payload as HrEventInvitePayload | undefined;
        setSubject(payload?.emailSubject ?? "");
        setBody(payload?.emailBody ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the invitation"))
      .finally(() => setLoading(false));
  }, [open, actionId]);

  const payload = action?.payload as HrEventInvitePayload | undefined;
  const firstName = payload?.recipients[0]?.name.split(/\s+/)[0] ?? "Alex";

  async function decide(kind: "approve" | "reject") {
    if (!action) return;
    if (kind === "approve" && !window.confirm(`Send to ${payload?.recipients.length} people now?`)) return;
    setBusy(kind);
    setError(null);
    try {
      const updated = kind === "approve"
        ? await approveAction(action.id, payload?.sendEmail ? { subject: subject.trim(), body: body.trim() } : {})
        : await rejectAction(action.id);
      onDecided(updated);
      if (kind === "approve") setDone(updated);
      else onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${kind} the invitation`);
    } finally {
      setBusy(null);
    }
  }

  const result = done?.result as { emailsSent?: number; emailsFailed?: Array<{ email: string; error: string }>; calendarEventId?: string | null } | null | undefined;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" slotProps={dialogPaper}>
      <DialogHeader
        title={done ? "Invitation sent" : "Approve invitation"}
        subtitle={payload ? `${payload.summary} · ${formatEventWhen(payload.startDateTime, payload.endDateTime)}` : "Loading..."}
        onClose={onClose}
        disabled={Boolean(busy)}
      />
      <DialogContent dividers sx={{ borderColor: tokens.border, ...multilineSx }}>
        {loading ? (
          <Stack sx={{ alignItems: "center", py: 5 }}><CircularProgress size={24} /></Stack>
        ) : done ? (
          <Stack spacing={1.5} sx={{ py: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CheckCircleRoundedIcon sx={{ color: tokens.accent }} />
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Done</Typography>
            </Stack>
            {payload?.addToCalendar && <Typography sx={{ fontSize: 13 }}>Calendar invite sent to {payload.recipients.length} people from your Work Google Calendar.</Typography>}
            {payload?.sendEmail && <Typography sx={{ fontSize: 13 }}>{result?.emailsSent ?? 0} of {payload.recipients.length} emails sent.</Typography>}
            {Boolean(result?.emailsFailed?.length) && (
              <Alert severity="warning">
                These emails failed and were not sent: {result!.emailsFailed!.map((f) => f.email).join(", ")}. Email them directly - approving again isn't possible because the others already went out.
              </Alert>
            )}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {payload && (
              <>
                <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
                  {payload.addToCalendar && <Chip icon={<CalendarMonthRoundedIcon />} label="Google Calendar invite" sx={{ fontWeight: 600 }} />}
                  {payload.sendEmail && <Chip icon={<MailOutlineRoundedIcon />} label={`${payload.recipients.length} personal emails`} sx={{ fontWeight: 600 }} />}
                </Stack>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.text, mb: 0.75 }}>Sent from your Work Google account to {payload.recipients.length} people</Typography>
                  <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, maxHeight: 120, overflowY: "auto" }}>
                    {payload.recipients.map((r) => <Chip key={r.employeeId} size="small" label={`${r.name} <${r.email}>`} />)}
                  </Stack>
                </Box>
                {payload.sendEmail && (
                  <Stack spacing={1.5}>
                    <TextField fullWidth label="Email subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                    <TextField fullWidth multiline minRows={6} maxRows={12} label="Message" value={body} onChange={(e) => setBody(e.target.value)} />
                    <Box sx={{ border: `1px dashed ${tokens.borderStrong}`, borderRadius: 2, p: 1.5, bgcolor: tokens.bg }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700, color: tokens.mutedDim, textTransform: "uppercase", letterSpacing: 0.5, mb: 0.5 }}>Preview for {firstName}</Typography>
                      <Typography sx={{ fontSize: 12.5, color: tokens.text, whiteSpace: "pre-wrap" }}>{body.replaceAll("{name}", firstName)}</Typography>
                    </Box>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.75 }}>
        {done ? (
          <Button variant="contained" onClick={onClose}>Close</Button>
        ) : (
          <>
            <Button color="error" onClick={() => void decide("reject")} disabled={!action || Boolean(busy)} sx={{ mr: "auto" }} startIcon={busy === "reject" ? <CircularProgress size={14} color="inherit" /> : undefined}>Reject</Button>
            <Button onClick={onClose} disabled={Boolean(busy)} sx={{ color: tokens.muted }}>Later</Button>
            <Button
              variant="contained"
              onClick={() => void decide("approve")}
              disabled={!action || Boolean(busy) || (payload?.sendEmail && (!subject.trim() || !body.trim()))}
              startIcon={busy === "approve" ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : <VerifiedUserRoundedIcon />}
            >
              Approve & send
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
