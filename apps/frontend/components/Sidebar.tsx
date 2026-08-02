"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { tokens } from "@/lib/theme";
import { getGoogleStatus, GoogleStatus } from "@/lib/api/google";

const NAV_ITEMS = [
  { href: "/", label: "Chat", icon: ChatBubbleRoundedIcon },
  { href: "/integrations", label: "Integrations", icon: HubRoundedIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      setGoogleStatus(await getGoogleStatus());
    } catch {
      setGoogleStatus(null);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <Box
      component="nav"
      sx={{
        width: 264,
        flexShrink: 0,
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: tokens.panel,
        borderRight: `1px solid ${tokens.border}`,
        px: 2,
        py: 2.5,
      }}
    >
      {/* Brand */}
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center", px: 0.5, mb: 3 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
          }}
        >
          <AutoAwesomeRoundedIcon sx={{ fontSize: 17, color: "#fff" }} />
        </Box>
        <Stack spacing={0}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: tokens.text, lineHeight: 1.2 }}>
            personal-assistant
          </Typography>
          <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
            rag + tools
          </Typography>
        </Stack>
      </Stack>

      {/* Nav */}
      <Typography
        sx={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: tokens.mutedDim,
          px: 1,
          mb: 1,
        }}
      >
        Workspace
      </Typography>

      <Stack spacing={0.5}>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Box
              key={item.href}
              component={Link}
              href={item.href}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 1.25,
                py: 1,
                borderRadius: 2,
                textDecoration: "none",
                color: active ? tokens.accentBright : tokens.muted,
                bgcolor: active ? tokens.accentDim : "transparent",
                fontWeight: active ? 600 : 500,
                transition: "background-color 0.15s ease, color 0.15s ease",
                "&:hover": {
                  bgcolor: active ? tokens.accentDim : tokens.panelRaised,
                  color: active ? tokens.accentBright : tokens.text,
                },
              }}
            >
              <Icon sx={{ fontSize: 19 }} />
              <Typography sx={{ fontSize: 14 }}>{item.label}</Typography>
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ flexGrow: 1 }} />

      {/* Footer — live connection status, not just decoration */}
      <Box
        component={Link}
        href="/integrations"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.25,
          py: 1.25,
          borderRadius: 2,
          border: `1px solid ${tokens.border}`,
          textDecoration: "none",
          "&:hover": { borderColor: tokens.borderStrong },
        }}
      >
        {isLoadingStatus ? (
          <CircularProgress size={14} sx={{ color: tokens.mutedDim }} />
        ) : googleStatus?.connected ? (
          <CheckCircleRoundedIcon sx={{ fontSize: 16, color: tokens.accent }} />
        ) : (
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: tokens.borderStrong }} />
        )}
        <Stack spacing={0}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.text }}>
            {googleStatus?.connected ? "Google connected" : "Google not connected"}
          </Typography>
          <Typography sx={{ fontSize: 11, color: tokens.mutedDim }}>
            {googleStatus?.connected ? googleStatus.googleEmail ?? "Gmail + Calendar active" : "Tap to connect"}
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}