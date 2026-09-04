"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import { tokens } from "@/lib/theme";

const FEATURES = [
  "Answers questions using your CV and any documents you add",
  "Drafts emails and LinkedIn posts — you approve before anything sends",
  "Knows your calendar and can schedule for you",
];

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: tokens.bg }}>
      {/* Branding panel - hidden below md, this is decoration, not primary content */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "space-between",
          width: "42%",
          maxWidth: 480,
          p: 6,
          background: `linear-gradient(160deg, ${tokens.accent} 0%, ${tokens.accentBright} 100%)`,
          color: "#fff",
        }}
      >
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(255,255,255,0.16)",
            }}
          >
            <AutoAwesomeRoundedIcon sx={{ fontSize: 19 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.2 }}>Personal AI Assistant</Typography>
        </Stack>

        <Stack spacing={3.5}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.3 }}>
            Your work, your inbox, your calendar — one assistant that actually knows you.
          </Typography>

          <Stack spacing={1.75}>
            {FEATURES.map((f) => (
              <Stack key={f} direction="row" spacing={1.25} sx={{ alignItems: "flex-start" }}>
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    flexShrink: 0,
                    mt: 0.15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(255,255,255,0.18)",
                  }}
                >
                  <CheckRoundedIcon sx={{ fontSize: 12 }} />
                </Box>
                <Typography sx={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(255,255,255,0.92)" }}>{f}</Typography>
              </Stack>
            ))}
          </Stack>
        </Stack>

        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
          Your documents stay private to your account.
        </Typography>
      </Box>

      {/* Form panel */}
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 6 }}>
        <Box sx={{ width: "100%", maxWidth: 380 }}>
          {/* Logo shown only on small screens, where the branding panel is hidden */}
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: "center", mb: 4, display: { xs: "flex", md: "none" } }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
              }}
            >
              <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14, color: tokens.text }}>Personal AI Assistant</Typography>
          </Stack>

          <Typography sx={{ fontSize: 22, fontWeight: 700, color: tokens.text, mb: 0.75 }}>{title}</Typography>
          <Typography variant="body2" sx={{ color: tokens.muted, mb: 3.5 }}>
            {subtitle}
          </Typography>

          {children}

          <Box sx={{ mt: 3, textAlign: "center" }}>{footer}</Box>
        </Box>
      </Box>
    </Box>
  );
}