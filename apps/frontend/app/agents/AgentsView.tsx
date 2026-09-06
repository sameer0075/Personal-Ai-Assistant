"use client";

import { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import PublicRoundedIcon from "@mui/icons-material/PublicRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import Sidebar from "@/components/Sidebar";
import { tokens } from "@/lib/theme";
import { GithubLogo } from "@/components/integrations/BrandLogo";
import { getAgentRoster, type AgentRoster, type SpecialistInfo } from "@/lib/api/agents";

// ---------------------------------------------------------------------------
// Hero geometry: specialists evenly spaced around a center core. Positions are
// computed from the live roster count (pentagon at 5, hexagon at 6, ...) so
// the canvas never assumes a fixed team size.
// ---------------------------------------------------------------------------
const CX = 300;
const CY = 300;
const RADIUS = 230;

function computeNodePositions(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const deg = -90 + (360 / n) * i;
    const rad = (deg * Math.PI) / 180;
    return { x: CX + RADIUS * Math.cos(rad), y: CY + RADIUS * Math.sin(rad) };
  });
}

function GithubBrandIcon({ sx }: { sx?: { fontSize?: number | string } }) {
  const size = typeof sx?.fontSize === "number" ? sx.fontSize : 20;
  return <GithubLogo size={size} fill={tokens.text} />;
}

const SPECIALIST_ICONS: Record<string, React.FC<{ sx?: object }>> = {
  email_agent: EmailRoundedIcon,
  calendar_agent: CalendarMonthRoundedIcon,
  linkedin_agent: LinkedInIcon,
  github_agent: GithubBrandIcon,
  web_agent: PublicRoundedIcon,
  knowledge_agent: PsychologyRoundedIcon,
};

const SPECIALIST_LABELS: Record<string, string> = {
  email_agent: "Email",
  calendar_agent: "Calendar",
  linkedin_agent: "LinkedIn",
  github_agent: "GitHub",
  web_agent: "Web",
  knowledge_agent: "Knowledge",
};

// Amber palette for approval-needed chips (stays invisible on light theme until hovered)
const approvalStyles = { bgcolor: "#f5f0e1", color: "#7a6524", border: "1px solid #e3d9b5" };
const normalStyles = { bgcolor: tokens.accentDim, color: tokens.accentBright, border: "1px solid transparent" };

// ---------------------------------------------------------------------------
// Hero component (pure, all animation is CSS/SMIL)
// ---------------------------------------------------------------------------
function Hero({ roster }: { roster: AgentRoster }) {
  const specialistNames = useMemo(() => roster.specialists.map((s) => s.name), [roster]);
  const nodePositions = useMemo(() => computeNodePositions(roster.specialists.length), [roster.specialists.length]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: { xs: 380, sm: 520 }, maxWidth: 600, mx: "auto" }}>
      {/* Subtle radial backdrop */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle at center, ${tokens.accentGlow} 0%, transparent 72%)`,
          pointerEvents: "none",
        }}
      />

      {/* SVG: rings, radar sweep, connection lines, data packets */}
      <svg
        viewBox="0 0 600 600"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      >
        {/* Outer rotating dashed ring */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS + 30}
          fill="none"
          stroke={tokens.border}
          strokeWidth={1}
          strokeDasharray="6 10"
          style={{ transformOrigin: `${CX}px ${CY}px`, animation: "spin 50s linear infinite" }}
        />
        {/* Inner counter-rotating dashed ring */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS - 20}
          fill="none"
          stroke={tokens.border}
          strokeWidth={0.8}
          strokeDasharray="4 12"
          style={{ transformOrigin: `${CX}px ${CY}px`, animation: "spinReverse 70s linear infinite" }}
        />
        {/* Radar sweep wedge */}
        <defs>
          <linearGradient id="sweepGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tokens.accent} stopOpacity={0.28} />
            <stop offset="100%" stopColor={tokens.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path
          d={`M ${CX} ${CY} L ${CX} ${CY - RADIUS - 30} A ${RADIUS + 30} ${RADIUS + 30} 0 0 1 ${CX + 40} ${CY - RADIUS - 20} Z`}
          fill="url(#sweepGrad)"
          style={{ transformOrigin: `${CX}px ${CY}px`, animation: "spin 12s linear infinite" }}
        />

        {/* Connection lines + moving data packets */}
        {nodePositions.map((pos, i) => {
          const id = `line${i}`;
          return (
            <g key={id}>
              <path
                id={id}
                d={`M ${CX} ${CY} L ${pos.x} ${pos.y}`}
                fill="none"
                stroke={tokens.accent}
                strokeWidth={1}
                opacity={0.25}
                strokeDasharray="3 6"
                style={{ strokeDashoffset: 0, animation: "dashScroll 1.8s linear infinite" }}
              />
              {/* Packet dot traveling center → node */}
              <circle r={4} fill={tokens.accent} opacity={0.9}>
                <animateMotion
                  dur={`${2.2 + i * 0.25}s`}
                  begin={`${i * 0.5}s`}
                  repeatCount="indefinite"
                  path={`M ${CX} ${CY} L ${pos.x} ${pos.y}`}
                />
              </circle>
              {/* Reverse packet dot (node → center) */}
              <circle r={3} fill={tokens.accent} opacity={0.5}>
                <animateMotion
                  dur={`${2.8 + i * 0.2}s`}
                  begin={`${1.2 + i * 0.35}s`}
                  repeatCount="indefinite"
                  path={`M ${pos.x} ${pos.y} L ${CX} ${CY}`}
                />
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Center core: pulsing rings + supervisor badge */}
      <Box
        sx={{
          position: "absolute",
          left: CX,
          top: CY,
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 130,
          height: 130,
        }}
      >
        {/* Outer pulsing glow ring */}
        <Box
          sx={{
            position: "absolute",
            inset: -12,
            borderRadius: "50%",
            border: `2px solid ${tokens.accent}`,
            opacity: 0.15,
            animation: "pulseRing 3.5s ease-in-out infinite",
          }}
        />
        {/* Second slower ring */}
        <Box
          sx={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: `1.5px solid ${tokens.accent}`,
            opacity: 0.22,
            animation: "pulseRing 5s ease-in-out infinite 0.8s",
          }}
        />
        {/* Solid core */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${tokens.accentDim} 0%, ${tokens.panel} 100%)`,
            border: `2px solid ${tokens.accent}`,
            boxShadow: `0 0 28px ${tokens.accentGlow}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.25,
          }}
        >
          <AutoAwesomeRoundedIcon sx={{ fontSize: 24, color: tokens.accent }} />
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: tokens.text, fontFamily: "var(--font-mono)", letterSpacing: "0.08em", lineHeight: 1 }}>
            SUPERVISOR
          </Typography>
          <Typography sx={{ fontSize: 8, color: tokens.mutedDim, fontFamily: "var(--font-mono)", lineHeight: 1, mt: 0.25 }}>
            {roster.supervisor.model}
          </Typography>
        </Box>
      </Box>

      {/* Specialist nodes (HTML, absolute on canvas) */}
      {roster.specialists.map((spec, i) => {
        const pos = nodePositions[i];
        const Icon = SPECIALIST_ICONS[spec.name] ?? AutoAwesomeRoundedIcon;
        const label = SPECIALIST_LABELS[spec.name] ?? spec.name;
        return (
          <Box
            key={spec.name}
            sx={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              animation: "nodeFadeIn 0.6s ease-out both",
              animationDelay: `${0.3 + i * 0.12}s`,
            }}
          >
            {/* Status dot */}
            <Box
              sx={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 9,
                height: 9,
                borderRadius: "50%",
                bgcolor: tokens.accent,
                border: `2px solid ${tokens.panel}`,
                boxShadow: `0 0 6px ${tokens.accent}`,
                animation: "statusPulse 2.8s ease-in-out infinite",
                animationDelay: `${i * 0.4}s`,
              }}
            />
            {/* Node bubble */}
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: tokens.panel,
                border: `1.5px solid ${tokens.accent}`,
                boxShadow: `0 0 14px ${tokens.accentGlow}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": { transform: "scale(1.12)", boxShadow: `0 0 22px ${tokens.accentGlow}` },
              }}
            >
              <Icon sx={{ fontSize: 22, color: tokens.accent }} />
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: tokens.text, fontFamily: "var(--font-mono)", textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap" }}>
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Detail cards below the hero
// ---------------------------------------------------------------------------
function SpecialistCard({ specialist, index }: { specialist: SpecialistInfo; index: number }) {
  const Icon = SPECIALIST_ICONS[specialist.name] ?? AutoAwesomeRoundedIcon;
  const label = SPECIALIST_LABELS[specialist.name] ?? specialist.name;

  return (
    <Stack
      spacing={1.5}
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: tokens.panel,
        border: `1px solid ${tokens.border}`,
        boxShadow: `0 1px 3px rgba(0,0,0,0.04)`,
        animation: "slideUp 0.45s ease-out both",
        animationDelay: `${index * 0.07}s`,
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box sx={{ width: 34, height: 34, borderRadius: "50%", bgcolor: tokens.accentDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon sx={{ fontSize: 18, color: tokens.accent }} />
        </Box>
        <Stack spacing={0}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>{label}</Typography>
          <Typography sx={{ fontSize: 10.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>{specialist.name}</Typography>
        </Stack>
      </Stack>
      <Typography sx={{ fontSize: 12.5, color: tokens.muted, lineHeight: 1.55 }}>
        {specialist.description}
      </Typography>
      {specialist.tools.length > 0 && (
        <Stack direction="row" spacing={0.6} sx={{ flexWrap: "wrap", gap: 0.6 }}>
          {specialist.tools.map((t) => (
            <Chip
              key={t.name}
              size="small"
              label={t.needsApproval ? `✉ ${t.name}` : t.name}
              title={t.needsApproval ? `${t.name} — human approval required` : t.description}
              sx={{ fontSize: 10, height: 22, ...((t.needsApproval ? approvalStyles : normalStyles) as object) }}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------
export default function AgentsView() {
  const [roster, setRoster] = useState<AgentRoster | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAgentRoster().then(setRoster).catch((e) => setError(e instanceof Error ? e.message : "Could not load agents"));
  }, []);

  return (
    <Box sx={{ display: "flex", height: "100dvh", bgcolor: tokens.bg }}>
      <Sidebar />

      <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {/* Header bar */}
        <Stack
          direction="row"
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${tokens.border}`,
            bgcolor: tokens.panelGlass,
            backdropFilter: "blur(10px)",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <Box sx={{ width: 28, height: 28, borderRadius: "8px", bgcolor: tokens.accentDim, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: tokens.accent }} />
          </Box>
          <Stack spacing={0}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.text }}>Agents</Typography>
            <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>multi-agent orchestration</Typography>
          </Stack>
        </Stack>

        {/* Content */}
        {error ? (
          <Stack sx={{ p: 4, alignItems: "center" }}>
            <Typography sx={{ fontSize: 13, color: tokens.danger }}>{error}</Typography>
          </Stack>
        ) : !roster ? (
          <Stack sx={{ p: 8, alignItems: "center", gap: 2 }}>
            <CircularProgress size={28} sx={{ color: tokens.accent }} />
            <Typography sx={{ fontSize: 12.5, color: tokens.mutedDim }}>Loading agents...</Typography>
          </Stack>
        ) : (
          <Container maxWidth="sm" sx={{ py: 4 }}>
            <Stack spacing={4}>
              {/* Hero */}
              <Hero roster={roster} />

              {/* Supervisor card */}
              <Stack
                spacing={1}
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  bgcolor: tokens.panel,
                  border: `1.5px solid ${tokens.accent}`,
                  boxShadow: `0 2px 12px ${tokens.accentGlow}`,
                  animation: "slideUp 0.45s ease-out both",
                }}
              >
                <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${tokens.accent} 0%, ${tokens.accentBright} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 18, color: "#fff" }} />
                  </Box>
                  <Stack spacing={0}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>Supervisor</Typography>
                    <Typography sx={{ fontSize: 10.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
                      routes to {roster.supervisor.specialistCount} specialists &middot; {roster.supervisor.model}
                    </Typography>
                  </Stack>
                </Stack>
                <Typography sx={{ fontSize: 12.5, color: tokens.muted, lineHeight: 1.55 }}>
                  {roster.supervisor.description}
                </Typography>
              </Stack>

              {/* Section label */}
              <Typography sx={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: tokens.mutedDim }}>
                Specialist Agents
              </Typography>

              {/* Specialist cards */}
              {roster.specialists.map((spec, i) => (
                <SpecialistCard key={spec.name} specialist={spec} index={i} />
              ))}
            </Stack>
          </Container>
        )}
      </Box>
    </Box>
  );
}