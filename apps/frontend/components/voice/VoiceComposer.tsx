"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import KeyboardAltOutlinedIcon from "@mui/icons-material/KeyboardAltOutlined";
import { tokens } from "@/lib/theme";
import { useSpeechToText } from "@/lib/useSpeechToText";

const WAVE_BARS = [0, 1, 2, 3, 4, 5, 6];

const DANGER_GLOW = "rgba(192, 57, 43, 0.20)";

export interface VoiceComposerProps {
  /** True while an assistant turn is streaming in — new utterances are parked until it settles. */
  disabled: boolean;
  muted: boolean;
  onToggleMute: () => void;
  /** Deliver a finished transcript as a chat turn. */
  onSubmit: (text: string) => void;
  /** Jump back to the keyboard input. */
  onShowText: () => void;
}

/**
 * The voice-first composer. One tap starts a single utterance; the final
 * transcript is submitted automatically (voice → chat → spoken reply). The
 * round mic doubles as the stop control while listening.
 */
export default function VoiceComposer({
  disabled,
  muted,
  onToggleMute,
  onSubmit,
  onShowText,
}: VoiceComposerProps) {
  const { supported, listening, transcript, error, start, stop } = useSpeechToText({
    onFinal: (text) => {
      if (text) onSubmit(text);
    },
  });

  function handleTap() {
    if (listening) {
      stop();
      return;
    }
    if (disabled) return;
    start();
  }

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${tokens.border}`,
        borderRadius: 3,
        bgcolor: tokens.panel,
        px: 2.5,
        py: 2.5,
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        "&:focus-within": {
          borderColor: tokens.accent,
          boxShadow: `0 0 0 3px ${tokens.accentGlow}`,
        },
      }}
    >
      {!supported ? (
        <Stack sx={{ alignItems: "center", gap: 1, py: 1 }}>
          <MicNoneRoundedIcon sx={{ fontSize: 26, color: tokens.mutedDim }} />
          <Typography sx={{ fontSize: 13, color: tokens.muted, textAlign: "center", maxWidth: 420 }}>
            Voice input isn't supported in this browser yet. Switch to Chat to type, or try Chrome,
            Edge or Safari.
          </Typography>
        </Stack>
      ) : (
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          {/* Live waveform — appears while the ear is open */}
          {listening && (
            <Stack direction="row" spacing={0.55} sx={{ alignItems: "center", height: 34 }}>
              {WAVE_BARS.map((i) => (
                <Box
                  key={i}
                  sx={{
                    width: 4,
                    height: 34,
                    borderRadius: 999,
                    bgcolor: tokens.accentBright,
                    opacity: 0.75,
                    transformOrigin: "center",
                    animation: "voiceWave 0.9s ease-in-out infinite",
                    animationDelay: `${i * 0.09}s`,
                  }}
                />
              ))}
            </Stack>
          )}

          {/* Big tap-to-talk / stop button with pulse rings while active */}
          <Box sx={{ position: "relative", width: 72, height: 72 }}>
            {listening && (
              <>
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `1.5px solid ${tokens.accent}`,
                    animation: "voicePing 1.6s ease-out infinite",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `1.5px solid ${tokens.accent}`,
                    animation: "voicePing 1.6s ease-out infinite",
                    animationDelay: "0.5s",
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `1.5px solid ${tokens.accent}`,
                    animation: "voicePing 1.6s ease-out infinite",
                    animationDelay: "1s",
                  }}
                />
              </>
            )}
            <Tooltip title={listening ? "Stop listening" : "Tap to talk"}>
              <IconButton
                onClick={handleTap}
                aria-label={listening ? "Stop listening" : "Start voice input"}
                sx={{
                  position: "absolute",
                  width: 64,
                  height: 64,
                  left: 4,
                  top: 4,
                  background: listening
                    ? tokens.danger
                    : `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                  color: "#fff",
                  boxShadow: listening
                    ? `0 0 0 5px ${DANGER_GLOW}`
                    : `0 8px 22px ${tokens.accentGlow}`,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  "&:hover": {
                    transform: "scale(1.04)",
                    background: listening
                      ? tokens.danger
                      : `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                    boxShadow: listening
                      ? `0 0 0 7px ${DANGER_GLOW}`
                      : `0 8px 26px ${tokens.accentGlow}`,
                  },
                  "&.Mui-disabled": {
                    background: tokens.panelRaised,
                    color: tokens.mutedDim,
                  },
                }}
              >
                {listening ? <StopRoundedIcon sx={{ fontSize: 28 }} /> : <MicNoneRoundedIcon sx={{ fontSize: 28 }} />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Live transcript / idle hint */}
          <Box sx={{ minHeight: 40, maxWidth: 480 }}>
            {listening ? (
              <Typography
                sx={{
                  fontSize: 14,
                  color: transcript ? tokens.text : tokens.mutedDim,
                  fontFamily: "var(--font-mono)",
                  textAlign: "center",
                  overflowWrap: "break-word",
                  fontWeight: transcript ? 500 : 400,
                }}
              >
                {transcript || "Listening…"}
              </Typography>
            ) : (
              <Typography sx={{ fontSize: 13, color: tokens.muted, textAlign: "center" }}>
                Tap the mic and speak — I'll listen, then answer out loud.
              </Typography>
            )}
            {error && (
              <Typography sx={{ fontSize: 12.5, color: tokens.danger, textAlign: "center", mt: 0.5 }}>
                {error}
              </Typography>
            )}
          </Box>

          {/* Footer: mute toggle + status + drop back to typing */}
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              pt: 1.25,
              borderTop: `1px dashed ${tokens.border}`,
            }}
          >
            <Tooltip title={muted ? "Turn on spoken replies" : "Mute spoken replies"}>
              <IconButton
                size="small"
                onClick={onToggleMute}
                sx={{ color: muted ? tokens.mutedDim : tokens.accentBright }}
              >
                {muted ? <VolumeOffRoundedIcon sx={{ fontSize: 19 }} /> : <VolumeUpRoundedIcon sx={{ fontSize: 19 }} />}
              </IconButton>
            </Tooltip>

            <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
              {disabled ? "assistant is answering…" : "mic enabled"}
            </Typography>

            <Box
              component="button"
              type="button"
              onClick={onShowText}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                bgcolor: "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 12.5,
                color: tokens.muted,
                p: 0.25,
                "&:hover": { color: tokens.accentBright },
              }}
            >
              <KeyboardAltOutlinedIcon sx={{ fontSize: 16 }} />
              Type
            </Box>
          </Stack>
        </Stack>
      )}
    </Paper>
  );
}