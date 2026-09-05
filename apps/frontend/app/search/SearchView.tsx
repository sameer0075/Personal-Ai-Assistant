"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InputBase from "@mui/material/InputBase";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import MailRoundedIcon from "@mui/icons-material/MailRounded";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";

import Sidebar from "@/components/Sidebar";
import { tokens } from "@/lib/theme";
import {
  unifiedSearch,
  type UnifiedSearchHit,
  type UnifiedSearchGroup,
  type UnifiedSearchSource,
  type UnifiedSearchResult,
} from "@/lib/api/search";

const SNIPPET_PREVIEW_CHARS = 260;
const RESULT_LIMIT = 8;

const SOURCE_ICONS: Record<
  UnifiedSearchSource,
  React.ComponentType<{ sx?: object }>
> = {
  chat: ChatBubbleRoundedIcon,
  conversation: ChatBubbleRoundedIcon,
  email: MailRoundedIcon,
  calendar: CalendarMonthRoundedIcon,
  linkedin: LinkedInIcon,
  documents: DescriptionRoundedIcon,
};

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function matchedByChip(hit: UnifiedSearchHit) {
  if (hit.matchedBy === "semantic") {
    const pct = Math.round((hit.similarity ?? 0) * 100);
    return (
      <Chip
        size="small"
        label={`${pct}% match · semantic`}
        sx={{ height: 20, fontSize: 10, bgcolor: tokens.accentDim, color: tokens.accentBright }}
      />
    );
  }
  return (
    <Chip
      size="small"
      label="keyword"
      sx={{ height: 20, fontSize: 10, bgcolor: tokens.panelRaised, color: tokens.muted }}
    />
  );
}

interface HitCardProps {
  hit: UnifiedSearchHit;
}

function HitCard({ hit }: HitCardProps) {
  const [expanded, setExpanded] = useState(false);
  const long = hit.snippet.length > SNIPPET_PREVIEW_CHARS;
  const Icon = SOURCE_ICONS[hit.source];

  const meta = useMemo(() => {
    const parts: string[] = [];
    if (hit.source === "chat") {
      parts.push(hit.role === "user" ? "You" : "Assistant");
    }
    if (hit.source === "email" && typeof hit.metadata?.from === "string") {
      parts.push(hit.metadata.from);
    }
    if (hit.source === "calendar" && typeof hit.metadata?.start === "string") {
      parts.push(new Date(hit.metadata.start).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }));
    }
    const date = formatDate(hit.createdAt);
    if (date) parts.push(date);
    return parts;
  }, [hit]);

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${tokens.border}`,
        bgcolor: tokens.panel,
        px: 1.75,
        py: 1.5,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        "&:hover": { borderColor: tokens.borderStrong },
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: "8px",
            bgcolor: tokens.accentDim,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 16, color: tokens.accent }} />
        </Box>
        <Stack spacing={0} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 600,
              color: tokens.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {hit.title || "(untitled)"}
          </Typography>
          {hit.source === "chat" && hit.sessionTitle && (
            <Typography sx={{ fontSize: 11, color: tokens.mutedDim }}>{hit.sessionTitle}</Typography>
          )}
        </Stack>
        {matchedByChip(hit)}
      </Stack>

      <Typography
        onClick={() => long && setExpanded((v) => !v)}
        sx={{
          mt: 1,
          fontSize: 12.5,
          lineHeight: 1.6,
          color: tokens.muted,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          cursor: long ? "pointer" : "default",
          ...(long && !expanded
            ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }
            : {}),
        }}
      >
        {hit.snippet || "(no text — title matched)"}
      </Typography>

      {meta.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center", flexWrap: "wrap" }}>
          {meta.map((m) => (
            <Typography key={m} sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
              {m}
            </Typography>
          ))}
        </Stack>
      )}

      {long && (
        <Stack
          direction="row"
          onClick={() => setExpanded((v) => !v)}
          sx={{ alignItems: "center", gap: 0.25, mt: 0.75, cursor: "pointer", color: tokens.accent }}
        >
          {expanded ? <ExpandLessRoundedIcon sx={{ fontSize: 14 }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 14 }} />}
          <Typography sx={{ fontSize: 11.5, fontWeight: 600 }}>{expanded ? "Show less" : "Show more"}</Typography>
        </Stack>
      )}
    </Box>
  );
}

interface GroupSectionProps {
  group: UnifiedSearchGroup;
}

function GroupSection({ group }: GroupSectionProps) {
  const Icon = SOURCE_ICONS[group.source];
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 0.5 }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: "6px",
            bgcolor: tokens.panelRaised,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 13, color: tokens.accent }} />
        </Box>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: tokens.text }}>
          {group.label}
        </Typography>
        <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
          {group.total}
        </Typography>
      </Stack>
      {group.hits.map((hit) => (
        <HitCard key={hit.id} hit={hit} />
      ))}
    </Stack>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <Stack sx={{ alignItems: "center", gap: 1, py: 10 }} spacing={1}>
      <Box
        sx={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          bgcolor: tokens.panelRaised,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SearchRoundedIcon sx={{ fontSize: 26, color: tokens.mutedDim }} />
      </Box>
      <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>
        {query ? `No matches for “${query}”` : "Search everything you own"}
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: tokens.muted, textAlign: "center" }}>
        {query
          ? "Try different wording, or a term from chat history, documents, emails, events, or LinkedIn posts."
          : "Chat history, documents, and synced emails, events and posts — semantic or by keyword."}
      </Typography>
    </Stack>
  );
}

export default function SearchView() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [result, setResult] = useState<UnifiedSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Gentle debounce so every keystroke isn't its own round-trip.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      setResult(null);
      setError(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    unifiedSearch(q, RESULT_LIMIT)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setResult(null);
        setError(err instanceof Error ? err.message : "Search failed");
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const totalHits = useMemo(
    () => result?.groups.reduce((sum, g) => sum + g.hits.length, 0) ?? 0,
    [result]
  );
  const highlighted = result?.highlight ?? null;
  const otherGroups = useMemo(
    () => (result?.groups ?? []).filter((g) => g.source !== highlighted?.source),
    [result, highlighted]
  );

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
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              bgcolor: tokens.accentDim,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SearchRoundedIcon sx={{ fontSize: 16, color: tokens.accent }} />
          </Box>
          <Stack spacing={0}>
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.text }}>Search</Typography>
            <Typography sx={{ fontSize: 11, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
              everything in one place
            </Typography>
          </Stack>
        </Stack>

        {/* Content */}
        <Box sx={{ maxWidth: 680, mx: "auto", px: 3, py: 4 }}>
          {/* Hero search bar */}
          <Stack spacing={1.5}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                height: 52,
                borderRadius: 999,
                bgcolor: tokens.panel,
                border: `1.5px solid ${query ? tokens.accent : tokens.border}`,
                boxShadow: query ? `0 0 0 4px ${tokens.accentGlow}` : "none",
                transition: "border-color 0.15s ease, box-shadow 0.15s ease",
              }}
            >
              <SearchRoundedIcon sx={{ fontSize: 20, color: tokens.accent, flexShrink: 0 }} />
              <InputBase
                inputRef={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats, documents, emails, events, posts…"
                fullWidth
                sx={{
                  fontSize: 14.5,
                  color: tokens.text,
                  "& input::placeholder": { color: tokens.mutedDim },
                }}
              />
              {isSearching ? (
                <CircularProgress size={16} sx={{ color: tokens.accent, flexShrink: 0 }} />
              ) : query ? (
                <Tooltip title="Clear">
                  <IconButton
                    size="small"
                    onClick={() => setQuery("")}
                    sx={{ color: tokens.mutedDim, flexShrink: 0 }}
                  >
                    <CloseRoundedIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Box>

            {result && (
              <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)", px: 1 }}>
                {totalHits} result{totalHits === 1 ? "" : "s"} across {result.groups.length} source
                {result.groups.length === 1 ? "" : "s"} · {result.tookMs} ms
              </Typography>
            )}
          </Stack>

          {/* Results */}
          {error ? (
            <Stack sx={{ alignItems: "center", py: 8 }}>
              <Typography sx={{ fontSize: 13, color: tokens.danger }}>{error}</Typography>
            </Stack>
          ) : isSearching && !result ? (
            <Stack sx={{ alignItems: "center", gap: 2, py: 8 }}>
              <CircularProgress size={26} sx={{ color: tokens.accent }} />
              <Typography sx={{ fontSize: 12.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
                searching…
              </Typography>
            </Stack>
          ) : result ? (
            highlighted && highlighted.hits.length > 0 ? (
              <Stack spacing={3} sx={{ mt: 3 }}>
                <Box
                  sx={{
                    p: 2.25,
                    borderRadius: 3,
                    bgcolor: tokens.panel,
                    border: `1.5px solid ${tokens.accent}`,
                    boxShadow: `0 2px 16px ${tokens.accentGlow}`,
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: tokens.accent }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: tokens.accentBright }}>
                        Best match · {highlighted.label}
                      </Typography>
                    </Stack>
                    {highlighted.hits.map((hit) => (
                      <HitCard key={hit.id} hit={hit} />
                    ))}
                  </Stack>
                </Box>

                {otherGroups.map((group) => (
                  <Box key={group.source}>
                    <Typography
                      sx={{
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: tokens.mutedDim,
                        mb: 1.25,
                      }}
                    >
                      {group.label}
                    </Typography>
                    <Stack spacing={1.25}>
                      {group.hits.map((hit) => (
                        <HitCard key={hit.id} hit={hit} />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Box sx={{ mt: 2 }}>
                {result.groups.map((group) => (
                  <Box key={group.source} sx={{ mb: 3 }}>
                    <GroupSection group={group} />
                  </Box>
                ))}
              </Box>
            )
          ) : (
            <Box sx={{ mt: 2 }}>
              <EmptyState query={query.trim()} />
            </Box>
          )}

          {result && result.groups.length === 0 && (
            <Box sx={{ mt: 2 }}>
              <EmptyState query={query.trim()} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}