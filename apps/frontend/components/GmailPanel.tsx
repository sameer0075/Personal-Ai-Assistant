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
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { tokens } from "@/lib/theme";
import { GmailMessageSummary, listGmailMessages, sendGmailMessage, syncGmailToRag } from "@/lib/api/gmail";

export default function GmailPanel() {
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleLoad() {
    setIsLoading(true);
    setError(null);
    try {
      setMessages(await listGmailMessages({ query: query || undefined, maxResults: 15 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      const summary = await syncGmailToRag({ query: query || undefined, maxResults: 15 });
      setSyncNote(`Indexed ${summary.ingested} new, skipped ${summary.skipped} already-known (of ${summary.found}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync to knowledge base");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      await sendGmailMessage({ to: composeTo, subject: composeSubject, body: composeBody });
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setComposeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderColor: tokens.border }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle2" sx={{ fontFamily: "var(--font-mono)" }}>
            Gmail
          </Typography>
          <Button
            size="small"
            variant="text"
            startIcon={<EditRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={() => setComposeOpen((v) => !v)}
          >
            Compose
          </Button>
        </Stack>

        <Collapse in={composeOpen}>
          <Stack
            component="form"
            onSubmit={handleSend}
            spacing={1.25}
            sx={{ p: 1.5, border: `1px solid ${tokens.border}`, borderRadius: 1.5 }}
          >
            <TextField
              label="To"
              type="email"
              size="small"
              required
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
            />
            <TextField
              label="Subject"
              size="small"
              required
              value={composeSubject}
              onChange={(e) => setComposeSubject(e.target.value)}
            />
            <TextField
              label="Body"
              size="small"
              required
              multiline
              minRows={3}
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              size="small"
              startIcon={isSending ? <CircularProgress size={14} /> : <SendRoundedIcon sx={{ fontSize: 16 }} />}
              disabled={isSending}
              sx={{ alignSelf: "flex-start" }}
            >
              Send
            </Button>
          </Stack>
        </Collapse>

        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            fullWidth
            placeholder="Gmail search, e.g. is:unread from:someone@example.com"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
          {messages.length === 0 && !isLoading && (
            <Typography variant="body2" color="text.secondary">
              No messages loaded yet — hit refresh.
            </Typography>
          )}
          {messages.map((m) => (
            <Stack key={m.id} spacing={0.25}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
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
    </Paper>
  );
}