"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TextareaAutosize from "@mui/material/TextareaAutosize";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css"
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Avatar from "@mui/material/Avatar";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import AttachFileRoundedIcon from "@mui/icons-material/AttachFileRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import EventAvailableRoundedIcon from "@mui/icons-material/EventAvailableRounded";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";
import BugReportRoundedIcon from "@mui/icons-material/BugReportRounded";
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { askQuestionStream, editMessageStream, AssistantAnswer, ToolCallTrace, type ChatAttachment } from "@/lib/api/chat";

import { tokens } from "@/lib/theme";
import { uploadCv } from "@/lib/api/documents";
import { askQuestion, editMessage } from "@/lib/api/chat";
import { PendingAction } from "@/lib/api/actions";
import { listSessions, getSessionMessages, deleteSession, type ChatSession } from "@/lib/api/sessions";
import Sidebar from "@/components/Sidebar";
import ActionApprovalModal from "@/components/ActionApprovalModal";
import RequireAuth from "@/lib/auth/RequireAuth";
import ModeSwitch, { type AssistantMode } from "@/components/voice/ModeSwitch";
import VoiceComposer from "@/components/voice/VoiceComposer";
import { useSpeechToText } from "@/lib/useSpeechToText";
import { speak, stopSpeaking, isSpeaking } from "@/lib/speech";

interface Message {
  id?: string; // present once persisted - required to edit a message
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallTrace[];
  pendingActions?: PendingAction[];
  attachments?: ChatAttachment[];
  isError?: boolean;
  isStreaming?: boolean;
}

const MAX_CHARS = 10000;
// Kept in sync with the backend's SupportedFileExt (apps/backend/src/modules/parsing/file-parser.ts).
const ATTACHMENT_ACCEPT = ".pdf,.docx,.txt";

const SUGGESTIONS = [
  {
    icon: MailRoundedIcon,
    text: "Email John a summary of my week",
  },
  {
    icon: EventAvailableRoundedIcon,
    text: "What's on my calendar today?",
  },
];

export default function Home() {
  return (
    <RequireAuth>
      <HomeContent />
    </RequireAuth>
  );
}

function HomeContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTitle, setUploadedTitle] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  // Chat attachment: a file the user attaches to THIS message to ask about it directly.
  // Deliberately separate from fileInputRef/handleUpload below, which push a file into the
  // persistent RAG knowledge base via /documents/upload. This one just rides along with
  // the chat turn - see askQuestionStream(..., file) in lib/api/chat.ts.
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const chatAttachmentInputRef = useRef<HTMLInputElement>(null);

  const [reviewAction, setReviewAction] = useState<PendingAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Voice: input mode (voice-first vs keyboard), plus live dictation into the
  // text composer. Refs mirror the state so the streaming handlers can read
  // the *current* mode without going stale mid-stream.
  const [mode, setMode] = useState<AssistantMode>("chat");
  const [voiceMuted, setVoiceMuted] = useState(false);
  const modeRef = useRef(mode);
  const voiceMutedRef = useRef(voiceMuted);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    voiceMutedRef.current = voiceMuted;
  }, [voiceMuted]);
  // Dropping out of voice mode (or muting) always kills any spoken reply.
  useEffect(() => {
    stopSpeaking();
  }, [mode, voiceMuted]);

  const dictation = useSpeechToText();
  useEffect(() => {
    if (dictation.listening && dictation.transcript) setQuestion(dictation.transcript);
  }, [dictation.listening, dictation.transcript]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions(await listSessions());
    } catch {
      // sidebar just shows an empty list - not worth a snackbar for this
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

    function appendAssistantTokenAndUpdateTool(update: (m: Message) => Message) {
    setMessages((prev) => {
      const next = [...prev];
      const lastIdx = next.length - 1;
      if (lastIdx >= 0) next[lastIdx] = update(next[lastIdx]);
      return next;
    });
  }

  /** Sets the id on the user message that started this turn (the one right before the streaming placeholder). */
  function setUserMessageId(userMessageId: string) {
    setMessages((prev) => {
      const next = [...prev];
      const idx = next.length - 2;
      if (idx >= 0 && next[idx].role === "user") next[idx] = { ...next[idx], id: userMessageId };
      return next;
    });
  }

  function streamHandlers(onDone: () => void, onSessionId?: (id: string) => void) {
    return {
      onSession: (sessionId: string) => onSessionId?.(sessionId),
      onToken: (content: string) => {
        appendAssistantTokenAndUpdateTool((m) => ({ ...m, content: m.content + content }));
      },
      onToolStart: (tool: string, input: unknown) => {
        appendAssistantTokenAndUpdateTool((m) => ({
          ...m,
          toolCalls: [...(m.toolCalls ?? []), { tool, input }],
        }));
      },
      onToolEnd: (tool: string, output?: string) => {
        appendAssistantTokenAndUpdateTool((m) => {
          const toolCalls = [...(m.toolCalls ?? [])];
          const idx = toolCalls.map((c) => c.tool === tool && c.output === undefined).lastIndexOf(true);
          if (idx !== -1) toolCalls[idx] = { ...toolCalls[idx], output };
          return { ...m, toolCalls };
        });
      },
      onComplete: (data: AssistantAnswer) => {
        setUserMessageId(data.userMessageId);
        appendAssistantTokenAndUpdateTool((m) => ({
          ...m,
          id: data.assistantMessageId,
          content: data.answer,
          toolCalls: data.toolCalls,
          pendingActions: data.pendingActions,
          isStreaming: false,
        }));
        setActiveSessionId(data.sessionId);
        refreshSessions();
        if (modeRef.current === "voice" && !voiceMutedRef.current) speak(data.answer);
        onDone();
      },
      onError: (message: string) => {
        appendAssistantTokenAndUpdateTool((m) =>
          m.content
            ? { ...m, isStreaming: false }
            : { ...m, content: message, isError: true, isStreaming: false }
        );
        onDone();
      },
    };
  }

  function openChatAttachmentPicker() {
    chatAttachmentInputRef.current?.click();
  }

  function handleChatAttachmentSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAttachedFile(file);
    e.target.value = "";
  }

  /**
   * Sends a chat turn with the given text (typed, edited, or transcribed from
   * voice) — the single path every input mode funnels through.
   */
  async function submitTurn(text: string, fileToSend?: File) {
    const trimmed = text.trim();
    if ((!trimmed && !fileToSend) || isAsking) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: trimmed,
        attachments: fileToSend
          ? [{ filename: fileToSend.name, mimeType: fileToSend.type, sizeBytes: fileToSend.size, truncated: false }]
          : undefined,
      },
      { role: "assistant", content: "", toolCalls: [], isStreaming: true },
    ]);
    setQuestion("");
    setAttachedFile(null);
    setIsAsking(true);

    try {
      await askQuestionStream(
        trimmed,
        activeSessionId ?? undefined,
        streamHandlers(() => setIsAsking(false)),
        undefined,
        fileToSend
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      appendAssistantTokenAndUpdateTool((m) => ({ ...m, content: message, isError: true, isStreaming: false }));
      setIsAsking(false);
    }
  }

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    submitTurn(question, attachedFile ?? undefined);
  }

  function handleSwitchMode(next: AssistantMode) {
    if (dictation.listening) dictation.stop();
    stopSpeaking();
    setMode(next);
  }

  /**
   * Edits a previously-sent user message. Truncates the visible thread down
   * to (and replacing) that message, then re-runs the turn - the old reply
   * and anything sent after it are gone, both locally and in the DB.
   */
  async function handleEditMessage(messageId: string, newContent: string) {
    if (!activeSessionId || isAsking) return;
    const trimmed = newContent.trim();
    if (!trimmed) return;

    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;

    setMessages((prev) => [
      ...prev.slice(0, idx),
      { id: messageId, role: "user", content: trimmed },
      { role: "assistant", content: "", toolCalls: [], isStreaming: true },
    ]);
    setIsAsking(true);

    try {
      await editMessageStream(
        activeSessionId,
        messageId,
        trimmed,
        streamHandlers(() => setIsAsking(false))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update message";
      appendAssistantTokenAndUpdateTool((m) => ({ ...m, content: message, isError: true, isStreaming: false }));
      setIsAsking(false);
    }
  }

  async function handleUpload(file: File) {
    setIsUploading(true);
    try {
      const result = await uploadCv(file);
      setUploadedTitle(result.title);
      setSnackbar({ message: `Indexed "${result.title}" — ${result.chunkCount} chunks`, severity: "success" });
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : "Upload failed", severity: "error" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSuggestionClick(text: string) {
    setQuestion(text);
    inputRef.current?.focus();
  }

  function handleNewChat() {
    setMessages([]);
    setQuestion("");
    setActiveSessionId(null);
  }

  async function handleSelectSession(sessionId: string) {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setIsLoadingSession(true);
    try {
      const stored = await getSessionMessages(sessionId);
      setMessages(stored);
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : "Failed to load chat", severity: "error" });
    } finally {
      setIsLoadingSession(false);
    }
  }

  /** Removes a chat from the sidebar. Its indexed conversation memory (search_knowledge_base) is untouched. */
  async function handleDeleteSession(sessionId: string) {
    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (sessionId === activeSessionId) {
        handleNewChat();
      }
    } catch (err) {
      setSnackbar({ message: err instanceof Error ? err.message : "Failed to delete chat", severity: "error" });
    }
  }

  function openReview(action: PendingAction) {
    setReviewAction(action);
    setReviewOpen(true);
  }

  function handleDecided(updated: PendingAction) {
    setReviewOpen(false);
    setReviewAction(null);
    setMessages((prev) =>
      prev.map((m) =>
        m.pendingActions?.some((a) => a.id === updated.id)
          ? { ...m, pendingActions: m.pendingActions.map((a) => (a.id === updated.id ? updated : a)) }
          : m
      )
    );
    setSnackbar(
      updated.status === "approved"
        ? {
            message:
              updated.type === "email"
                ? "Email sent."
                : updated.type === "linkedin_post"
                  ? "Post published."
                  : updated.type === "github_issue"
                    ? "Issue created on GitHub."
                    : "Comment posted on GitHub.",
            severity: "success",
          }
        : { message: "Draft discarded.", severity: "success" }
    );
  }

  return (
    <Box sx={{ display: "flex", height: "100dvh", bgcolor: tokens.bg }}>
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isLoadingSessions={isLoadingSessions}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
      />

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <Stack
          direction="row"
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 2,
            borderBottom: `1px solid ${tokens.border}`,
            bgcolor: tokens.panelGlass,
            backdropFilter: "blur(10px)",
          }}
        >
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.text, flexShrink: 0 }}>
            {messages.length === 0 ? "New Chat" : "Chat"}
          </Typography>

          <Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <ModeSwitch mode={mode} onChange={handleSwitchMode} />
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              hidden
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />

            {uploadedTitle && (
              <Chip
                icon={<DescriptionRoundedIcon sx={{ fontSize: 15 }} />}
                label={uploadedTitle}
                size="small"
                sx={{
                  bgcolor: tokens.accentDim,
                  border: `1px solid ${tokens.userBorder}`,
                  color: tokens.accentBright,
                  maxWidth: 200,
                }}
              />
            )}

            <Tooltip title="Upload a document to index">
              <span>
                <IconButton
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  sx={{ border: `1px solid ${tokens.border}`, borderRadius: 2 }}
                >
                  {isUploading ? <CircularProgress size={16} /> : <UploadFileRoundedIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="New chat">
              <span>
                <IconButton
                  size="small"
                  onClick={handleNewChat}
                  disabled={messages.length === 0}
                  sx={{ border: `1px solid ${tokens.border}`, borderRadius: 2 }}
                >
                  <AddRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Chat area */}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          <Container maxWidth="md" sx={{ py: 4, height: "100%" }}>
            {isLoadingSession ? (
              <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center" }}>
                <CircularProgress size={20} sx={{ color: tokens.mutedDim }} />
              </Stack>
            ) : messages.length === 0 ? (
              <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                {mode !== "voice" && (
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 2.5,
                    background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                    boxShadow: `0 8px 24px ${tokens.accentGlow}`,
                  }}
                >
                  <AutoAwesomeRoundedIcon sx={{ fontSize: 28, color: "#fff" }} />
                </Box>
                )}

                <Typography sx={{ fontSize: 20, fontWeight: 700, color: tokens.text, mb: 0.75 }}>
                  {mode === "voice" ? "How can I assist you?" : "Hi, how can I help you today?"}
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.muted, mb: 3.5, maxWidth: 380 }}>
                  {mode === "voice"
                    ? "Activate the orb below and speak naturally. I'll listen, process, and respond."
                    : "Upload your CV, connect Google under Integrations, and ask me to look things up, draft emails, or manage your calendar."}
                </Typography>

                {mode !== "voice" && (
                <Stack spacing={1.25} sx={{ width: "100%", maxWidth: 420 }}>
                  {SUGGESTIONS.map(({ icon: Icon, text }) => (
                    <Paper
                      key={text}
                      onClick={() => handleSuggestionClick(text)}
                      elevation={0}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        px: 2,
                        py: 1.5,
                        cursor: "pointer",
                        border: `1px solid ${tokens.border}`,
                        borderRadius: 2.5,
                        bgcolor: tokens.panel,
                        transition: "border-color 0.15s ease, transform 0.15s ease",
                        "&:hover": {
                          borderColor: tokens.accent,
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      <Icon sx={{ fontSize: 18, color: tokens.accentBright }} />
                      <Typography variant="body2" sx={{ color: tokens.text, flex: 1, textAlign: "left" }}>
                        {text}
                      </Typography>
                      <ArrowForwardRoundedIcon sx={{ fontSize: 16, color: tokens.mutedDim }} />
                    </Paper>
                  ))}
                </Stack>
                )}
              </Stack>
            ) : (
              <Stack spacing={2.5}>
                {messages.map((m, i) => (
                  <MessageBubble
                    key={m.id ?? i}
                    message={m}
                    onReviewAction={openReview}
                    onEditMessage={handleEditMessage}
                    disabled={isAsking}
                  />
                ))}
                {/* Once the streaming placeholder message has any content or tool
                    activity, it speaks for itself - the bouncing dots only cover
                    the brief gap before the first token/tool call arrives. */}
                {isAsking &&
                  !messages[messages.length - 1]?.content &&
                  !messages[messages.length - 1]?.toolCalls?.length && (
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: tokens.accentDim, color: tokens.accentBright }}>
                        <SmartToyRoundedIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                      <Stack direction="row" spacing={0.6}>
                        {[0, 1, 2].map((d) => (
                          <Box
                            key={d}
                            sx={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              bgcolor: tokens.mutedDim,
                              animation: "bounceDot 1.2s ease-in-out infinite",
                              animationDelay: `${d * 0.15}s`,
                            }}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  )}
              </Stack>
            )}
            <div ref={scrollAnchorRef} />
          </Container>
        </Box>

        {/* Composer */}
        <Box sx={{ px: 3, pb: 3, pt: 1 }}>
          {mode === "voice" ? (
            <Container maxWidth="lg" disableGutters>
              <VoiceComposer
                disabled={isAsking}
                muted={voiceMuted}
                onToggleMute={() => {
                  setVoiceMuted((muted) => {
                    if (!muted) stopSpeaking();
                    return !muted;
                  });
                }}
                onSubmit={submitTurn}
                onShowText={() => handleSwitchMode("chat")}
              />
            </Container>
          ) : (
            <Container maxWidth="md" disableGutters>
            <Paper
              component="form"
              onSubmit={handleAsk}
              elevation={0}
              sx={{
                border: `1px solid ${tokens.border}`,
                borderRadius: 3,
                bgcolor: tokens.panel,
                px: 2,
                pt: 1.25,
                pb: 1,
                transition: "box-shadow 0.15s ease, border-color 0.15s ease",
                "&:focus-within": {
                  borderColor: tokens.accent,
                  boxShadow: `0 0 0 3px ${tokens.accentGlow}`,
                },
              }}
            >
              {attachedFile && (
                <Chip
                  icon={<DescriptionRoundedIcon sx={{ fontSize: 15 }} />}
                  label={attachedFile.name}
                  size="small"
                  onDelete={() => setAttachedFile(null)}
                  deleteIcon={<CloseRoundedIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    mb: 1,
                    maxWidth: "100%",
                    bgcolor: tokens.panelRaised,
                    border: `1px solid ${tokens.border}`,
                    color: tokens.text,
                  }}
                />
              )}

              <input
                ref={chatAttachmentInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                hidden
                onChange={handleChatAttachmentSelected}
              />

              <TextField
                inputRef={inputRef}
                fullWidth
                multiline
                minRows={1}
                maxRows={12}
                variant="standard"
                autoComplete="off"
                placeholder="Ask something, or tell it to send an email / schedule something…"
                value={question}
                onChange={(e) => e.target.value.length <= MAX_CHARS && setQuestion(e.target.value)}
                disabled={isAsking}
                slotProps={{ input: { disableUnderline: true } }}
                sx={{ "& .MuiInputBase-input": { fontSize: 14, py: 0.5 } }}
              />

              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mt: 0.5 }}>
                <Stack direction="row" spacing={0.25}>
                  <Tooltip
                    title={
                      !dictation.supported
                        ? "Voice input isn't supported in this browser"
                        : dictation.listening
                          ? "Stop listening"
                          : "Speak instead of typing"
                    }
                  >
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
                        disabled={!dictation.supported || isAsking}
                        sx={{
                          border: `1px solid ${dictation.listening ? tokens.danger : tokens.border}`,
                          borderRadius: 2,
                          color: dictation.listening ? tokens.danger : tokens.muted,
                          bgcolor: dictation.listening ? tokens.dangerDim : "transparent",
                          animation: dictation.listening ? "micPulse 1.4s ease-out infinite" : undefined,
                        }}
                      >
                        {dictation.listening ? (
                          <StopRoundedIcon sx={{ fontSize: 18 }} />
                        ) : (
                          <MicNoneRoundedIcon sx={{ fontSize: 18 }} />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Attach a file to ask about, just for this chat">
                    <span>
                      <IconButton
                        size="small"
                        onClick={openChatAttachmentPicker}
                        disabled={isAsking}
                        sx={{ color: tokens.muted }}
                      >
                        <AttachFileRoundedIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>

                <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                  <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
                    {question.length}/{MAX_CHARS}
                  </Typography>
                  <IconButton
                    type="submit"
                    size="small"
                    disabled={isAsking || (!question.trim() && !attachedFile)}
                    sx={{
                      width: 32,
                      height: 32,
                      background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                      color: "#fff",
                      "&:hover": {
                        background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                        boxShadow: `0 0 0 4px ${tokens.accentGlow}`,
                      },
                      "&.Mui-disabled": { background: tokens.panelRaised, color: tokens.mutedDim },
                    }}
                  >
                    {isAsking ? <CircularProgress size={14} sx={{ color: tokens.mutedDim }} /> : <ArrowUpwardRoundedIcon sx={{ fontSize: 17 }} />}
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
            </Container>
            )}
            <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, textAlign: "center", mt: 1.25 }}>
              Works for you, grows with you
            </Typography>
        </Box>
      </Box>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snackbar ? (
          <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar(null)} sx={{ width: "100%" }}>
            {snackbar.message}
          </Alert>
        ) : undefined}
      </Snackbar>

      <ActionApprovalModal
        action={reviewAction}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onDecided={handleDecided}
      />
    </Box>
  );
}

function MessageBubble({
  message,
  onReviewAction,
  onEditMessage,
  disabled,
}: {
  message: Message;
  onReviewAction: (action: PendingAction) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  disabled: boolean;
}) {
  const isUser = message.role === "user";
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [speaking, setSpeaking] = useState(false);

  function toggleSpeak() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else if (!isSpeaking()) {
      setSpeaking(true);
      speak(message.content, { onEnd: () => setSpeaking(false) });
    }
  }

  function startEdit() {
    setDraft(message.content);
    setIsEditing(true);
  }

  function saveEdit() {
    if (!message.id) return;
    setIsEditing(false);
    onEditMessage(message.id, draft);
  }

  return (
    <Stack
      direction="row"
      spacing={1.25}
      sx={{ alignItems: "flex-start", flexDirection: isUser ? "row-reverse" : "row" }}
    >
      <Avatar
        sx={{
          width: 28,
          height: 28,
          flexShrink: 0,
          bgcolor: isUser ? tokens.panelRaised : tokens.accentDim,
          color: isUser ? tokens.muted : tokens.accentBright,
          border: `1px solid ${isUser ? tokens.border : tokens.userBorder}`,
        }}
      >
        {isUser ? <PersonRoundedIcon sx={{ fontSize: 16 }} /> : <SmartToyRoundedIcon sx={{ fontSize: 16 }} />}
      </Avatar>

      <Stack spacing={0.5} sx={{ maxWidth: isUser ? "75%" : "80%", width: isUser ? "fit-content" : "100%" }}>
        {isEditing ? (
          <Paper
            elevation={0}
            sx={{ p: 1.25, borderRadius: "14px 4px 14px 14px", border: `1px solid ${tokens.accent}`, bgcolor: tokens.userTint }}
          >
            <TextField
              autoFocus
              fullWidth
              multiline
              variant="standard"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              slotProps={{ input: { disableUnderline: true } }}
              sx={{ "& .MuiInputBase-input": { fontSize: 14, color: tokens.text } }}
            />
            <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end", mt: 0.5 }}>
              <IconButton size="small" onClick={() => setIsEditing(false)} sx={{ color: tokens.muted }}>
                <CloseRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" onClick={saveEdit} disabled={!draft.trim()} sx={{ color: tokens.accentBright }}>
                <CheckRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Stack>
          </Paper>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: 1.75,
              borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
              border: `1px solid ${message.isError ? tokens.danger : isUser ? tokens.userBorder : tokens.border}`,
              bgcolor: message.isError ? tokens.dangerDim : isUser ? tokens.userTint : tokens.panel,
            }}
          >
            {message.attachments && message.attachments.length > 0 && (
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", mb: message.content ? 1.25 : 0 }}>
                {message.attachments.map((a, i) => (
                  <Chip
                    key={i}
                    icon={<DescriptionRoundedIcon sx={{ fontSize: 14 }} />}
                    label={a.filename}
                    size="small"
                    sx={{
                      bgcolor: tokens.panelRaised,
                      border: `1px solid ${tokens.border}`,
                      color: tokens.muted,
                    }}
                  />
                ))}
              </Stack>
            )}
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({ children }) => (
                  <Typography
                    variant="body2"
                    sx={{
                      color: message.isError ? tokens.danger : tokens.text,
                      mb: 1.5,
                      lineHeight: 1.7,
                    }}
                  >
                    {children}
                  </Typography>
                ),

                h1: ({ children }) => (
                  <Typography variant="h4" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>
                    {children}
                  </Typography>
                ),

                h2: ({ children }) => (
                  <Typography variant="h5" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>
                    {children}
                  </Typography>
                ),

                h3: ({ children }) => (
                  <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 700 }}>
                    {children}
                  </Typography>
                ),

                ul: ({ children }) => (
                  <Box component="ul" sx={{ pl: 3, mb: 2 }}>
                    {children}
                  </Box>
                ),

                ol: ({ children }) => (
                  <Box component="ol" sx={{ pl: 3, mb: 2 }}>
                    {children}
                  </Box>
                ),

                li: ({ children }) => (
                  <Box component="li" sx={{ mb: 0.5 }}>
                    {children}
                  </Box>
                ),

                blockquote: ({ children }) => (
                  <Box
                    sx={{
                      borderLeft: "4px solid #4f46e5",
                      pl: 2,
                      my: 2,
                      color: "text.secondary",
                      fontStyle: "italic",
                    }}
                  >
                    {children}
                  </Box>
                ),

                code({ inline, className, children, ...props }: any) {
                  if (inline) {
                    return (
                      <Box
                        component="code"
                        sx={{
                          px: 0.6,
                          py: 0.2,
                          borderRadius: 1,
                          bgcolor: "#2d2d2d",
                          color: "#ffcb6b",
                          fontFamily: "monospace",
                          fontSize: "0.9em",
                        }}
                        {...props}
                      >
                        {children}
                      </Box>
                    );
                  }

                  return (
                    <Box
                      component="pre"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        overflowX: "auto",
                        bgcolor: "#0d1117",
                        my: 2,
                      }}
                    >
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </Box>
                  );
                },

                table: ({ children }) => (
                  <Box
                    component="table"
                    sx={{
                      width: "100%",
                      borderCollapse: "collapse",
                      my: 2,
                      "& th, & td": {
                        border: "1px solid #444",
                        p: 1,
                      },
                      "& th": {
                        bgcolor: "#222",
                      },
                    }}
                  >
                    {children}
                  </Box>
                ),

                a: ({ children, href }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#60a5fa",
                    }}
                  >
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

            {message.toolCalls && message.toolCalls.length > 0 && (
              <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap", mt: 1.5 }}>
                {message.toolCalls.map((call, j) => {
                  const isRunning = message.isStreaming && call.output === undefined;
                  return (
                    <Tooltip
                      key={j}
                      title={
                        isRunning
                          ? `Running ${call.tool}…`
                          : typeof call.input === "object"
                            ? JSON.stringify(call.input)
                            : String(call.input)
                      }
                    >
                      <Chip
                        size="small"
                        icon={
                          isRunning ? (
                            <CircularProgress size={11} sx={{ color: tokens.accentBright }} />
                          ) : (
                            <BuildRoundedIcon sx={{ fontSize: 13 }} />
                          )
                        }
                        label={call.tool}
                        sx={{
                          bgcolor: isRunning ? tokens.accentDim : tokens.panelRaised,
                          border: `1px solid ${isRunning ? tokens.userBorder : tokens.border}`,
                          color: isRunning ? tokens.accentBright : tokens.muted,
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Stack>
            )}

            {message.pendingActions && message.pendingActions.length > 0 && (
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {message.pendingActions.map((action, i) => (
                  <PendingActionCard key={action.id ?? i} action={action} onReview={() => onReviewAction(action)} />
                ))}
              </Stack>
            )}
          </Paper>
        )}

        {/* Edit affordance - only for your own already-persisted messages */}
        {isUser && !isEditing && message.id && !message.isError && (
          <Stack direction="row" sx={{ justifyContent: "flex-end", px: 0.5 }}>
            <Tooltip title="Edit message">
              <span>
                <IconButton size="small" onClick={startEdit} disabled={disabled} sx={{ color: tokens.mutedDim, p: 0.4 }}>
                  <EditRoundedIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}

        {/* Read-aloud affordance for finished assistant messages */}
        {!isUser && !message.isStreaming && !!message.content.trim() && (
          <Stack direction="row" sx={{ px: 0.5 }}>
            <Tooltip title={speaking ? "Stop reading" : "Read aloud"}>
              <span>
                <IconButton
                  size="small"
                  onClick={toggleSpeak}
                  sx={{ color: speaking ? tokens.accentBright : tokens.mutedDim, p: 0.4 }}
                >
                  {speaking ? (
                    <VolumeOffRoundedIcon sx={{ fontSize: 13 }} />
                  ) : (
                    <VolumeUpRoundedIcon sx={{ fontSize: 13 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

function PendingActionCard({ action, onReview }: { action: PendingAction; onReview: () => void }) {
  const isEmail = action.type === "email";
  const isLinkedin = action.type === "linkedin_post";
  const isGithubIssue = action.type === "github_issue";
  const isGithubComment = action.type === "github_comment";

  const preview =
    isEmail && "subject" in action.payload
      ? `To ${action.payload.to} — "${action.payload.subject}"`
      : isLinkedin && "commentary" in action.payload
        ? action.payload.commentary.slice(0, 80) + (action.payload.commentary.length > 80 ? "…" : "")
        : isGithubIssue && "title" in action.payload
          ? `${action.payload.repo} — "${action.payload.title}"`
          : isGithubComment && "issueNumber" in action.payload
            ? `${action.payload.repo} #${action.payload.issueNumber}`
            : "";

  const statusChip =
    action.status === "pending" ? (
      <Chip size="small" label="Awaiting your approval" sx={{ bgcolor: tokens.accentDim, color: tokens.accentBright }} />
    ) : action.status === "approved" ? (
      <Chip size="small" label={isEmail ? "Sent" : isLinkedin ? "Published" : "Created"} sx={{ bgcolor: tokens.panelRaised, color: tokens.text }} />
    ) : (
      <Chip size="small" label="Rejected" sx={{ bgcolor: tokens.panelRaised, color: tokens.muted }} />
    );

  return (
    <Paper
      elevation={0}
      sx={{ p: 1.25, borderRadius: 2, border: `1px solid ${tokens.userBorder}`, bgcolor: tokens.panelRaised }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
        {isEmail ? (
          <MailOutlineRoundedIcon sx={{ fontSize: 18, color: tokens.accentBright, mt: 0.25 }} />
        ) : isLinkedin ? (
          <ArrowUpwardRoundedIcon sx={{ fontSize: 18, color: tokens.accentBright, mt: 0.25 }} />
        ) : (
          <BugReportRoundedIcon sx={{ fontSize: 18, color: tokens.accentBright, mt: 0.25 }} />
        )}
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.text }}>
            {isEmail ? "Drafted email" : isLinkedin ? "Drafted LinkedIn post" : isGithubIssue ? "Drafted GitHub issue" : "Drafted GitHub comment"}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.muted, overflowWrap: "break-word" }}>
            {preview}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.5 }}>
            {statusChip}
            {action.status === "pending" && (
              <Typography
                component="button"
                onClick={onReview}
                sx={{ fontSize: 12.5, color: tokens.accentBright, bgcolor: "transparent", border: "none", cursor: "pointer", p: 0, fontWeight: 600 }}
              >
                Review &amp; approve
              </Typography>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}