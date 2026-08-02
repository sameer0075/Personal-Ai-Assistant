"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { tokens } from "@/lib/theme";

const NAV_LINKS = [
  { href: "/", label: "chat" },
  { href: "/integrations", label: "integrations" },
];

export default function AppHeader({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ bgcolor: "background.paper", borderBottom: `1px solid ${tokens.border}` }}
    >
      <Toolbar sx={{ gap: 2.5, minHeight: 56 }}>
        <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "primary.main",
              boxShadow: `0 0 8px ${tokens.accent}`,
            }}
          />
          <Typography
            variant="h1"
            sx={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.02em", color: "text.secondary" }}
          >
            personal-assistant
          </Typography>
        </Stack>

        <Stack direction="row" spacing={2}>
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Typography
                key={link.href}
                component={Link}
                href={link.href}
                variant="body2"
                sx={{
                  textDecoration: "none",
                  color: active ? "primary.main" : "text.secondary",
                  fontWeight: active ? 600 : 400,
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  "&:hover": { color: "primary.main" },
                }}
              >
                /{link.label}
              </Typography>
            );
          })}
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        {children}
      </Toolbar>
    </AppBar>
  );
}