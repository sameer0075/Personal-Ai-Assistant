"use client";

import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import VolumeUpRoundedIcon from "@mui/icons-material/VolumeUpRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import KeyboardAltOutlinedIcon from "@mui/icons-material/KeyboardAltOutlined";
import { tokens } from "@/lib/theme";
import { useSpeechToText } from "@/lib/useSpeechToText";
import { isSpeaking as checkSpeaking } from "@/lib/speech";

export interface VoiceComposerProps {
  disabled: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onSubmit: (text: string) => void;
  onShowText: () => void;
}

type OrbState = "idle" | "listening" | "speaking";

const ORB_SIZE = 360;
const CX = ORB_SIZE / 2;
const CY = ORB_SIZE / 2;
const BARS = 24;

function JarvisOrb({ state }: { state: OrbState }) {
  const active = state === "listening";
  const speaking = state === "speaking";

  return (
    <svg
      width={ORB_SIZE}
      height={ORB_SIZE}
      viewBox={`0 0 ${ORB_SIZE} ${ORB_SIZE}`}
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="jg-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={tokens.accentBright} stopOpacity={0.9} />
          <stop offset="60%" stopColor={tokens.accent} stopOpacity={0.6} />
          <stop offset="100%" stopColor={tokens.accent} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="jg-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={tokens.accent} stopOpacity={active || speaking ? 0.3 : 0.12} />
          <stop offset="100%" stopColor={tokens.accent} stopOpacity={0} />
        </radialGradient>
        <filter id="jg-blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Ambient glow */}
      <circle
        cx={CX}
        cy={CY}
        r={155}
        fill="url(#jg-glow)"
        style={{
          animation: "jarvisGlowPulse 3s ease-in-out infinite",
          opacity: active || speaking ? 1 : 0.5,
        }}
      />

      {/* Outer ring — dashed, slow spin */}
      <circle
        cx={CX}
        cy={CY}
        r={142}
        fill="none"
        stroke={tokens.accent}
        strokeWidth={active || speaking ? 1.8 : 1}
        strokeDasharray="12 8"
        opacity={active || speaking ? 0.7 : 0.25}
        style={{
          transformOrigin: `${CX}px ${CY}px`,
          animation: active
            ? "jarvisRingSpin 4s linear infinite, jarvisDashScroll 1.2s linear infinite"
            : speaking
              ? "jarvisRingSpinReverse 6s linear infinite, jarvisDashScroll 1.8s linear infinite"
              : "jarvisRingSpin 20s linear infinite, jarvisDashScroll 4s linear infinite",
        }}
      />

      {/* Middle ring — counter-rotate, solid-ish */}
      <circle
        cx={CX}
        cy={CY}
        r={113}
        fill="none"
        stroke={tokens.accentBright}
        strokeWidth={active || speaking ? 1.4 : 0.8}
        strokeDasharray="3 14"
        opacity={active || speaking ? 0.55 : 0.18}
        style={{
          transformOrigin: `${CX}px ${CY}px`,
          animation: active
            ? "jarvisRingSpinReverse 3s linear infinite"
            : speaking
              ? "jarvisRingSpin 5s linear infinite"
              : "jarvisRingSpinReverse 16s linear infinite",
        }}
      />

      {/* Inner ring — pulsing */}
      <circle
        cx={CX}
        cy={CY}
        r={84}
        fill="none"
        stroke={tokens.accent}
        strokeWidth={0.8}
        opacity={active || speaking ? 0.4 : 0.12}
        style={{ animation: "jarvisCorePulse 2.5s ease-in-out infinite" }}
      />

      {/* Radar sweep — only while listening */}
      {active && (
        <g style={{ transformOrigin: `${CX}px ${CY}px`, animation: "jarvisRadarSweep 2.5s linear infinite" }}>
          <path
            d={`M ${CX} ${CY} L ${CX} ${CY - 140} A 140 140 0 0 1 ${CX + 60} ${CY - 124} Z`}
            fill={tokens.accent}
            opacity={0.12}
          />
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - 140}
            stroke={tokens.accentBright}
            strokeWidth={1.2}
            opacity={0.6}
          />
        </g>
      )}

      {/* Ping rings — listening or speaking */}
      {(active || speaking) &&
        [0, 0.55, 1.1].map((delay) => (
          <circle
            key={delay}
            cx={CX}
            cy={CY}
            r={68}
            fill="none"
            stroke={tokens.accent}
            strokeWidth={1.5}
            opacity={0}
            style={{
              animation: `jarvisPing ${active ? "1.8s" : "2.4s"} ease-out infinite`,
              animationDelay: `${delay}s`,
            }}
          />
        ))}

      {/* Circular waveform bars — listening only */}
      {active &&
        Array.from({ length: BARS }).map((_, i) => {
          const angle = (i / BARS) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const r1 = 57;
          const r2 = 70;
          return (
            <line
              key={i}
              x1={CX + r1 * Math.cos(rad)}
              y1={CY + r1 * Math.sin(rad)}
              x2={CX + r2 * Math.cos(rad)}
              y2={CY + r2 * Math.sin(rad)}
              stroke={tokens.accentBright}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.7}
              style={{
                transformOrigin: `${CX}px ${CY}px`,
                animation: `jarvisBarBounce 0.8s ease-in-out infinite`,
                animationDelay: `${i * 0.035}s`,
              }}
            />
          );
        })}

      {/* Core glow circle */}
      <circle cx={CX} cy={CY} r={46} fill="url(#jg-core)" filter="url(#jg-blur)" />

      {/* Core ring */}
      <circle
        cx={CX}
        cy={CY}
        r={42}
        fill={tokens.panel}
        stroke={tokens.accent}
        strokeWidth={active || speaking ? 2 : 1.2}
        opacity={0.95}
      />

      {/* Orbiting data dots — listening only */}
      {active &&
        [0, 120, 240].map((deg) => (
          <circle
            key={deg}
            cx={CX}
            cy={CY - 132}
            r={3}
            fill={tokens.accentBright}
            opacity={0.6}
            style={{
              transformOrigin: `${CX}px ${CY}px`,
              animation: "jarvisRingSpin 3.5s linear infinite",
              animationDelay: `${(deg / 360) * 3.5}s`,
            }}
          />
        ))}
    </svg>
  );
}

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

  const [speaking, setSpeaking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollRef.current = setInterval(() => {
      setSpeaking(checkSpeaking());
    }, 300);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const orbState: OrbState = listening ? "listening" : speaking ? "speaking" : "idle";

  function handleTap() {
    if (listening) {
      stop();
      return;
    }
    if (disabled || speaking) return;
    start();
  }

  return (
    <Stack sx={{ alignItems: "center", gap: 2.5, py: 2 }}>
      {!supported ? (
        <Stack sx={{ alignItems: "center", gap: 1.5, py: 2 }}>
          <MicNoneRoundedIcon sx={{ fontSize: 28, color: tokens.mutedDim }} />
          <Typography sx={{ fontSize: 13, color: tokens.muted, textAlign: "center", maxWidth: 420 }}>
            Voice input isn't supported in this browser yet. Switch to Chat to type, or try Chrome,
            Edge or Safari.
          </Typography>
        </Stack>
      ) : (
        <>
          {/* Status label */}
          <Typography
            sx={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: listening ? tokens.accentBright : speaking ? tokens.accent : tokens.mutedDim,
              fontWeight: 600,
              animation: listening || speaking ? "statusPulse 1.6s ease-in-out infinite" : "none",
            }}
          >
            {listening ? "Listening" : speaking ? "Speaking" : "Standby"}
          </Typography>

          {/* Orb — tap anywhere on it */}
          <Tooltip title={listening ? "Stop listening" : speaking ? "Assistant is speaking" : "Tap to talk"}>
            <Box
              onClick={handleTap}
              sx={{
                position: "relative",
                cursor: listening ? "pointer" : speaking ? "default" : "pointer",
                borderRadius: "50%",
                transition: "transform 0.15s ease",
                "&:hover": listening ? { transform: "scale(1.03)" } : speaking ? {} : { transform: "scale(1.04)" },
                "&:active": { transform: "scale(0.97)" },
              }}
            >
              <JarvisOrb state={orbState} />
              <Box
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 76,
                  height: 76,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  background: listening
                    ? tokens.danger
                    : `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                  boxShadow: listening
                    ? `0 0 0 5px rgba(192, 57, 43, 0.2), 0 8px 22px rgba(192, 57, 43, 0.35)`
                    : `0 8px 22px ${tokens.accentGlow}`,
                  pointerEvents: "none",
                }}
              >
                {listening ? <StopRoundedIcon sx={{ fontSize: 26 }} /> : <MicNoneRoundedIcon sx={{ fontSize: 26 }} />}
              </Box>
            </Box>
          </Tooltip>

          {/* Transcript */}
          <Box sx={{ minHeight: 44, maxWidth: 440, textAlign: "center", px: 2 }}>
            {listening && (
              <Typography
                sx={{
                  fontSize: 14.5,
                  color: transcript ? tokens.text : tokens.mutedDim,
                  fontFamily: "var(--font-mono)",
                  fontWeight: transcript ? 500 : 400,
                  overflowWrap: "break-word",
                  lineHeight: 1.6,
                }}
              >
                {transcript || (
                  <span style={{ opacity: 0.5 }}>
                    Awaiting input<span style={{ animation: "jarvisTranscriptBlink 1s step-end infinite" }}>█</span>
                  </span>
                )}
              </Typography>
            )}
            {!listening && !speaking && !error && (
              <Typography sx={{ fontSize: 13, color: tokens.muted }}>
                Tap the orb and speak — I'll listen, then answer out loud.
              </Typography>
            )}
            {speaking && (
              <Typography sx={{ fontSize: 13, color: tokens.accent, fontFamily: "var(--font-mono)" }}>
                Responding…
              </Typography>
            )}
            {error && (
              <Typography sx={{ fontSize: 12.5, color: tokens.danger, mt: 0.5 }}>
                {error}
              </Typography>
            )}
          </Box>

          {/* Footer controls */}
          <Stack
            direction="row"
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              maxWidth: 360,
              pt: 1.5,
              borderTop: `1px solid ${tokens.border}`,
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

            <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
              {disabled ? "processing…" : "voice ready"}
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
        </>
      )}
    </Stack>
  );
}
