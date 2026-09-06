"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { tokens } from "@/lib/theme";
import { getGoogleStatus, GoogleStatus } from "@/lib/api/google";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import Avatar from "@mui/material/Avatar";
import type { ChatSession } from "@/lib/api/sessions";
import { useAuth } from "@/lib/auth/AuthProvider";

const NAV_ITEMS = [
  { href: "/", label: "Chat", icon: ChatBubbleRoundedIcon },
  { href: "/search", label: "Search", icon: SearchRoundedIcon },
  { href: "/automations", label: "Automations", icon: ScheduleRoundedIcon },
  { href: "/integrations", label: "Integrations", icon: HubRoundedIcon },
  { href: "/agents", label: "Agents", icon: AutoAwesomeRoundedIcon },
];

interface SidebarProps {
  sessions?: ChatSession[];
  activeSessionId?: string | null;
  isLoadingSessions?: boolean;
  onSelectSession?: (id: string) => void;
  onNewChat?: () => void;
  onDeleteSession?: (id: string) => void;
}

export default function Sidebar({
  sessions = [],
  activeSessionId = null,
  isLoadingSessions = false,
  onSelectSession = () => {},
  onNewChat = () => {},
  onDeleteSession = () => {},
}: SidebarProps = {}) {
  const pathname = usePathname();
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user, logout } = useAuth();

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

  function handleDeleteClick(e: React.MouseEvent, session: ChatSession) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${session.title}"? This only removes the chat - anything it remembers stays searchable.`)) {
      return;
    }
    setDeletingId(session.id);
    onDeleteSession(session.id);
  }

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

      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", px: 1, mt: 3, mb: 1 }}>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: tokens.mutedDim,
          }}
        >
          Chats
        </Typography>
        <Tooltip title="New chat">
          <IconButton size="small" onClick={onNewChat} sx={{ color: tokens.muted }}>
            <AddRoundedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box sx={{ flexGrow: 1, overflowY: "auto", minHeight: 0 }}>
        {isLoadingSessions ? (
          <Stack sx={{ alignItems: "center", py: 2 }}>
            <CircularProgress size={16} sx={{ color: tokens.mutedDim }} />
          </Stack>
        ) : sessions?.length === 0 ? (
          <Typography sx={{ fontSize: 12.5, color: tokens.mutedDim, px: 1.25, py: 1 }}>
            No chats yet — start one above.
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {sessions?.map((session) => {
              const active = session.id === activeSessionId;
              return (
                <Stack
                  key={session.id}
                  direction="row"
                  onClick={() => onSelectSession(session.id)}
                  sx={{
                    alignItems: "center",
                    gap: 0.5,
                    pl: 1.25,
                    pr: 0.5,
                    py: 0.9,
                    borderRadius: 2,
                    cursor: "pointer",
                    color: active ? tokens.accentBright : tokens.muted,
                    bgcolor: active ? tokens.accentDim : "transparent",
                    fontWeight: active ? 600 : 500,
                    transition: "background-color 0.15s ease, color 0.15s ease",
                    "&:hover": {
                      bgcolor: active ? tokens.accentDim : tokens.panelRaised,
                      color: active ? tokens.accentBright : tokens.text,
                      "& .session-delete-btn": { opacity: 1 },
                    },
                  }}
                >
                  <ChatBubbleRoundedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
                  <Typography
                    sx={{
                      fontSize: 13,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {session.title}
                  </Typography>
                  <IconButton
                    size="small"
                    className="session-delete-btn"
                    onClick={(e) => handleDeleteClick(e, session)}
                    disabled={deletingId === session.id}
                    sx={{
                      opacity: 0,
                      transition: "opacity 0.15s ease",
                      color: tokens.mutedDim,
                      "&:hover": { color: tokens.danger },
                    }}
                  >
                    {deletingId === session.id ? (
                      <CircularProgress size={13} />
                    ) : (
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    )}
                  </IconButton>
                </Stack>
              );
            })}
          </Stack>
        )}
      </Box>

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

      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, mt: 1, px: 1.25, py: 1, borderRadius: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", minWidth: 0 }}>
          <Avatar sx={{ width: 26, height: 26, fontSize: 12, fontWeight: 700, bgcolor: tokens.accentDim, color: tokens.accentBright }}>
            {(user?.name || user?.email || "?").charAt(0).toUpperCase()}
          </Avatar>
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.name || user?.email}
            </Typography>
            {user?.name && (
              <Typography sx={{ fontSize: 11, color: tokens.mutedDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.email}
              </Typography>
            )}
          </Stack>
        </Stack>
        <Tooltip title="Log out">
          <IconButton size="small" onClick={logout} sx={{ color: tokens.mutedDim, "&:hover": { color: tokens.danger } }}>
            <LogoutRoundedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        </Tooltip>
      </Stack>

    </Box>
  );
}