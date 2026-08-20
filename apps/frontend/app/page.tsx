"use client";

import { useEffect, useRef, useState } from "react";
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
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
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

import { tokens } from "@/lib/theme";
import { askQuestion, uploadCv } from "@/lib/api";
import { ToolCallTrace } from "@/lib/api/chat";
import { PendingAction } from "@/lib/api/actions";
import Sidebar from "@/components/Sidebar";
import ActionApprovalModal from "@/components/ActionApprovalModal";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallTrace[];
  pendingActions?: PendingAction[];
  isError?: boolean;
}

const MAX_CHARS = 10000;

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTitle, setUploadedTitle] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: "success" | "error" } | null>(null);

  const [reviewAction, setReviewAction] = useState<PendingAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

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

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");
    setIsAsking(true);

    try {
      const result: any = await askQuestion(trimmed);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, toolCalls: result.toolCalls, pendingActions: result.pendingActions },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) => [...prev, { role: "assistant", content: message, isError: true }]);
    } finally {
      setIsAsking(false);
    }
  }

  function handleSuggestionClick(text: string) {
    setQuestion(text);
    inputRef.current?.focus();
  }

  function handleNewChat() {
    setMessages([]);
    setQuestion("");
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
        ? { message: updated.type === "email" ? "Email sent." : "Post published.", severity: "success" }
        : { message: "Draft discarded.", severity: "success" }
    );
  }

  return (
    <Box sx={{ display: "flex", height: "100dvh", bgcolor: tokens.bg }}>
      <Sidebar />

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
          <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.text }}>
            {messages.length === 0 ? "New Chat" : "Chat"}
          </Typography>

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
            {messages.length === 0 ? (
              <Stack sx={{ height: "100%", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
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

                <Typography sx={{ fontSize: 20, fontWeight: 700, color: tokens.text, mb: 0.75 }}>
                  Hi, how can I help you today?
                </Typography>
                <Typography variant="body2" sx={{ color: tokens.muted, mb: 3.5, maxWidth: 380 }}>
                  Upload your CV, connect Google under Integrations, and ask me to look things up, draft emails, or
                  manage your calendar.
                </Typography>

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
              </Stack>
            ) : (
              <Stack spacing={2.5}>
                {messages.map((m, i) => (
                  <MessageBubble key={i} message={m} onReviewAction={openReview} />
                ))}
                {isAsking && (
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
                  <Tooltip title="Voice input — coming soon">
                    <span>
                      <IconButton size="small" disabled sx={{ color: tokens.mutedDim }}>
                        <MicNoneRoundedIcon sx={{ fontSize: 19 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Attach a document to index">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        sx={{ color: tokens.muted }}
                      >
                        <UploadFileRoundedIcon sx={{ fontSize: 18 }} />
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
                    disabled={isAsking || !question.trim()}
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
            <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, textAlign: "center", mt: 1.25 }}>
              Works for you, grows with you
            </Typography>
          </Container>
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

function MessageBubble({ message, onReviewAction }: { message: Message; onReviewAction: (action: PendingAction) => void }) {
  const isUser = message.role === "user";

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

      <Paper
        elevation={0}
        sx={{
          p: 1.75,
          maxWidth: isUser ? "75%" : "80%",
width: isUser ? "fit-content" : "100%",
          borderRadius: isUser ? "14px 4px 14px 14px" : "4px 14px 14px 14px",
          border: `1px solid ${message.isError ? tokens.danger : isUser ? tokens.userBorder : tokens.border}`,
          bgcolor: message.isError ? tokens.dangerDim : isUser ? tokens.userTint : tokens.panel,
        }}
      >
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
            {message.toolCalls.map((call, j) => (
              <Tooltip
                key={j}
                title={typeof call.input === "object" ? JSON.stringify(call.input) : String(call.input)}
              >
                <Chip
                  size="small"
                  icon={<BuildRoundedIcon sx={{ fontSize: 13 }} />}
                  label={call.tool}
                  sx={{
                    bgcolor: tokens.panelRaised,
                    border: `1px solid ${tokens.border}`,
                    color: tokens.muted,
                  }}
                />
              </Tooltip>
            ))}
          </Stack>
        )}

        {message.pendingActions && message.pendingActions.length > 0 && (
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {message.pendingActions.map((action) => (
              <PendingActionCard key={action.id} action={action} onReview={() => onReviewAction(action)} />
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}

function PendingActionCard({ action, onReview }: { action: PendingAction; onReview: () => void }) {
  const isEmail = action.type === "email";
  const preview =
    isEmail && "subject" in action.payload
      ? `To ${action.payload.to} — "${action.payload.subject}"`
      : "commentary" in action.payload
        ? action.payload.commentary.slice(0, 80) + (action.payload.commentary.length > 80 ? "…" : "")
        : "";

  const statusChip =
    action.status === "pending" ? (
      <Chip size="small" label="Awaiting your approval" sx={{ bgcolor: tokens.accentDim, color: tokens.accentBright }} />
    ) : action.status === "approved" ? (
      <Chip size="small" label={isEmail ? "Sent" : "Published"} sx={{ bgcolor: tokens.panelRaised, color: tokens.text }} />
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
        ) : (
          <ArrowUpwardRoundedIcon sx={{ fontSize: 18, color: tokens.accentBright, mt: 0.25 }} />
        )}
        <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: tokens.text }}>
            {isEmail ? "Drafted email" : "Drafted LinkedIn post"}
          </Typography>
          <Typography variant="caption" sx={{ color: tokens.muted, overflowWrap: "break-word" }}>
            {preview}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", mt: 0.5 }}>
            {statusChip}
            {action.status === "pending" && (
              <Button size="small" onClick={onReview} sx={{ color: tokens.accentBright }}>
                Review &amp; approve
              </Button>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}