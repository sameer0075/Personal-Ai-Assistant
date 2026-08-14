import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import BuildRoundedIcon from "@mui/icons-material/BuildRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import { tokens } from "../theme/theme";
import { InputBase } from "@mui/material";

interface ToolCallTrace {
  tool: string;
  input: unknown;
  output?: string;
}

interface PendingConfirmation {
  requestId: string;
  tool: string;
  input: unknown;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; input: unknown; output?: string }[];
}

interface ChatPanelProps {
  projectId: string;
  projectOpen: boolean;
  /** Path of the file currently active in the editor, relative to the project root - or null if none. */
  activePath: string | null;
  /** Paths of every currently-open editor tab, relative to the project root. */
  openPaths: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallTrace[];
  isError?: boolean;
}

export default function ChatPanel({ projectId, projectOpen, activePath, openPaths }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  useEffect(() => {
  return window.api.onToolConfirmationRequest((request) => {
    if (request.projectId !== projectId) return;
    setPendingConfirmation({ requestId: request.requestId, tool: request.tool, input: request.input });
  });
}, [projectId]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isAsking || !projectOpen) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");
    setIsAsking(true);

    try {
      const result = await window.api.sendMessage(projectId, trimmed, {
        activeFilePath: activePath,
        openFilePaths: openPaths,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: result.answer, toolCalls: result.toolCalls }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: err instanceof Error ? err.message : "Something went wrong", isError: true },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  async function respondToConfirmation(approved: boolean) {
    if (!pendingConfirmation) return;
    await window.api.respondToToolConfirmation(pendingConfirmation.requestId, approved);
    setPendingConfirmation(null);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const history = await window.api.getChatHistory(projectId);
      if (!cancelled) setMessages(history);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

return (
  <Box
    sx={{
      width: 390,
      flexShrink: 0,

      display: "flex",
      flexDirection: "column",

      bgcolor: tokens.sidebar,

      borderLeft:
        `1px solid ${tokens.border}`,
    }}
  >
    {/* Header */}
    <Stack
      direction="row"
      sx={{
        height: 42,
        px: 1.5,
        alignItems: "center",
        borderBottom:
          `1px solid ${tokens.border}`,
      }}
    >
      <SmartToyRoundedIcon
        sx={{
          fontSize: 17,
          mr: 0.75,
          color: tokens.accentBright,
        }}
      />

      <Typography
        sx={{
          fontSize: 12,
          fontWeight: 600,
          color: tokens.text,
        }}
      >
        CODING AGENT
      </Typography>

      <Box sx={{ flex: 1 }} />

      <Chip
        size="small"
        label="Clear"
        onClick={async () => {
          await window.api.clearChatHistory(projectId);
          setMessages([]);
        }}
        sx={{
          height: 20,
          fontSize: 10,
          mr: 0.75,
          cursor: "pointer",
          bgcolor: "transparent",
          color: tokens.muted,
          border: `1px solid ${tokens.border}`,
          "&:hover": { color: tokens.danger, borderColor: tokens.danger },
        }}
      />

      <Chip
        size="small"
        label="Ready"
        sx={{
          height: 20,
          fontSize: 10,

          bgcolor: "transparent",
          color: tokens.success,

          border:
            `1px solid ${tokens.border}`,
        }}
      />
    </Stack>

    {/* Active file indicator - makes "explain this file" unambiguous at a glance */}
      {activePath && (
        <Stack
          direction="row"
          sx={{
            height: 26,
            px: 1.5,
            alignItems: "center",
            gap: 0.5,
            borderBottom: `1px solid ${tokens.border}`,
            bgcolor: tokens.panelRaised,
          }}
        >
          <Typography sx={{ fontSize: 10.5, color: tokens.mutedDim }}>Active:</Typography>
          <Typography sx={{ fontSize: 10.5, color: tokens.muted, fontFamily: "monospace" }}>{activePath}</Typography>
        </Stack>
      )}

    {/* Conversation */}
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        px: 1.5,
        py: 2,
      }}
    >
      {messages.length === 0 ? (
        <Stack
          sx={{
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            px: 3,
          }}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",

              bgcolor: tokens.accentDim,

              mb: 1.5,
            }}
          >
            <SmartToyRoundedIcon
              sx={{
                color: tokens.accentBright,
              }}
            />
          </Box>

          <Typography
            sx={{
              fontSize: 14,
              color: tokens.textBright,
              mb: 0.5,
            }}
          >
            Coding Agent
          </Typography>

          <Typography
            sx={{
              fontSize: 12,
              lineHeight: 1.6,
              color: tokens.muted,
            }}
          >
            Ask me to explore your code,
            fix bugs, refactor files, or
            implement features.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={2.5}>
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
            />
          ))}

          {isAsking && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: "center",
              }}
            >
              <SmartToyRoundedIcon
                sx={{
                  fontSize: 17,
                  color: tokens.accentBright,
                }}
              />

              <CircularProgress size={12} />

              <Typography
                sx={{
                  fontSize: 12,
                  color: tokens.muted,
                }}
              >
                Working...
              </Typography>
            </Stack>
          )}
        </Stack>
      )}

      <div ref={scrollAnchorRef} />
    </Box>

    {pendingConfirmation && (
      <Box sx={{ px: 1.5, py: 1.25, borderTop: `1px solid ${tokens.border}`, bgcolor: tokens.panelRaised }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 0.75 }}>
          <BuildRoundedIcon sx={{ fontSize: 14, color: tokens.accentBright }} />
          <Typography sx={{ fontSize: 12, color: tokens.text }}>
            Agent wants to run <b>{pendingConfirmation.tool}</b>
          </Typography>
        </Stack>

        <Typography
          sx={{
            fontSize: 11,
            fontFamily: "monospace",
            color: tokens.muted,
            whiteSpace: "pre-wrap",
            mb: 1,
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          {JSON.stringify(pendingConfirmation.input, null, 2)}
        </Typography>

        <Stack direction="row" spacing={1}>
          <Chip
            size="small"
            label="Approve"
            onClick={() => respondToConfirmation(true)}
            sx={{ cursor: "pointer", bgcolor: tokens.accent, color: "#fff", "&:hover": { bgcolor: tokens.accentBright } }}
          />
          <Chip
            size="small"
            label="Reject"
            onClick={() => respondToConfirmation(false)}
            sx={{ cursor: "pointer", bgcolor: "transparent", color: tokens.danger, border: `1px solid ${tokens.danger}` }}
          />
        </Stack>
      </Box>
    )}

    {/* Input */}
    <Box
      sx={{
        p: 1.25,
        borderTop:
          `1px solid ${tokens.border}`,
      }}
    >
      <Box
        component="form"
        onSubmit={handleAsk}
        sx={{
          position: "relative",

          bgcolor: tokens.panelRaised,

          border:
            `1px solid ${tokens.borderLight}`,

          borderRadius: 1,

          "&:focus-within": {
            borderColor: tokens.muted,
          },
        }}
      >
        <InputBase
            fullWidth
            multiline
            maxRows={6}
            placeholder={
                projectOpen
                ? "Ask anything..."
                : "Open a project first"
            }
            value={question}
            onChange={(e: any) => setQuestion(e.target.value)}
            disabled={isAsking || !projectOpen}
            sx={{
                px: 1.25,
                py: 1,

                fontSize: 13,
                lineHeight: 1.5,

                color: tokens.text,

                "& textarea": {
                fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: 13,
                lineHeight: 1.5,
                },

                "& input::placeholder, & textarea::placeholder": {
                color: tokens.muted,
                opacity: 1,
                },

                "&.Mui-disabled": {
                opacity: 0.6,
                },
            }}
        />

        <Stack
          direction="row"
          sx={{
            px: 0.75,
            pb: 0.75,
            justifyContent: "flex-end",
          }}
        >
          <IconButton
            type="submit"
            disabled={
              isAsking ||
              !projectOpen ||
              !question.trim()
            }
            sx={{
              width: 28,
              height: 28,

              bgcolor:
                question.trim()
                  ? tokens.accent
                  : tokens.active,

              color:
                question.trim()
                  ? "#fff"
                  : tokens.muted,

              "&:hover": {
                bgcolor: tokens.accentBright,
              },
            }}
          >
            <ArrowUpwardRoundedIcon
              sx={{ fontSize: 16 }}
            />
          </IconButton>
        </Stack>
      </Box>

      <Typography
        sx={{
          mt: 0.75,
          textAlign: "center",
          fontSize: 10,
          color: tokens.mutedDim,
        }}
      >
        AI can make mistakes. Review changes before saving.
      </Typography>
    </Box>
  </Box>
);
}

// function MessageBubble({ message }: { message: Message }) {
//   const isUser = message.role === "user";

//   return (
//     <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
//       <Avatar
//         sx={{
//           width: 22,
//           height: 22,
//           bgcolor: isUser ? tokens.panelRaised : tokens.accentDim,
//           color: isUser ? tokens.muted : tokens.accentBright,
//         }}
//       >
//         {isUser ? <PersonRoundedIcon sx={{ fontSize: 13 }} /> : <SmartToyRoundedIcon sx={{ fontSize: 13 }} />}
//       </Avatar>

//       <Paper
//         variant="outlined"
//         sx={{
//           p: 1.25,
//           flex: 1,
//           borderColor: message.isError ? tokens.danger : tokens.border,
//           bgcolor: tokens.panel,
//         }}
//       >
//         <Typography sx={{ fontSize: 12.5, whiteSpace: "pre-wrap", color: message.isError ? tokens.danger : tokens.text }}>
//           {message.content}
//         </Typography>

//         {message.toolCalls && message.toolCalls.length > 0 && (
//           <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: "wrap", mt: 1 }}>
//             {message.toolCalls.map((call, j) => (
//               <Tooltip key={j} title={typeof call.input === "object" ? JSON.stringify(call.input) : String(call.input)}>
//                 <Chip
//                   size="small"
//                   icon={<BuildRoundedIcon sx={{ fontSize: 11 }} />}
//                   label={call.tool}
//                   sx={{ height: 20, fontSize: 10.5, bgcolor: tokens.panelRaised, border: `1px solid ${tokens.border}`, color: tokens.muted }}
//                 />
//               </Tooltip>
//             ))}
//           </Stack>
//         )}
//       </Paper>
//     </Stack>
//   );
// }

function MessageBubble({
  message,
}: {
  message: Message;
}) {
  const isUser = message.role === "user";

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "flex-start",
        }}
      >
        {isUser ? (
          <PersonRoundedIcon
            sx={{
              mt: 0.2,
              fontSize: 17,
              color: tokens.muted,
            }}
          />
        ) : (
          <SmartToyRoundedIcon
            sx={{
              mt: 0.2,
              fontSize: 17,
              color: tokens.accentBright,
            }}
          />
        )}

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 600,
              mb: 0.5,
              color: isUser
                ? tokens.muted
                : tokens.text,
            }}
          >
            {isUser ? "You" : "Agent"}
          </Typography>

          <Typography
            sx={{
              fontSize: 13,
              lineHeight: 1.65,
              whiteSpace: "pre-wrap",

              color: message.isError
                ? tokens.danger
                : tokens.text,
            }}
          >
            {message.content}
          </Typography>

          {message.toolCalls &&
            message.toolCalls.length > 0 && (
              <Stack
                spacing={0.5}
                sx={{ mt: 1 }}
              >
                {message.toolCalls.map(
                  (call, index) => (
                    <Stack
                      key={index}
                      direction="row"
                      sx={{
                        alignItems: "center",
                        gap: 0.75,

                        px: 1,
                        py: 0.5,

                        bgcolor:
                          tokens.panelRaised,

                        border:
                          `1px solid ${tokens.border}`,

                        borderRadius: 0.5,
                      }}
                    >
                      <BuildRoundedIcon
                        sx={{
                          fontSize: 13,
                          color: tokens.muted,
                        }}
                      />

                      <Typography
                        sx={{
                          fontSize: 11,
                          color: tokens.muted,
                          fontFamily:
                            "monospace",
                        }}
                      >
                        {call.tool}
                      </Typography>

                      <Box sx={{ flex: 1 }} />

                      <Typography
                        sx={{
                          fontSize: 10,
                          color: tokens.success,
                        }}
                      >
                        ✓
                      </Typography>
                    </Stack>
                  )
                )}
              </Stack>
            )}
        </Box>
      </Stack>
    </Box>
  );
}