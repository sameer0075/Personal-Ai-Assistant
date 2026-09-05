"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import MicNoneRoundedIcon from "@mui/icons-material/MicNoneRounded";
import { tokens } from "@/lib/theme";

export type AssistantMode = "chat" | "voice";

const MODES: { value: AssistantMode; label: string; icon: typeof MicNoneRoundedIcon }[] = [
  { value: "chat", label: "Chat", icon: ChatBubbleOutlineRoundedIcon },
  { value: "voice", label: "Voice", icon: MicNoneRoundedIcon },
];

/**
 * Segmented Chat / Voice switch. The raised white pill marks the active mode;
 * the whole thing sits quietly in the top bar so it never reads as a button.
 */
export default function ModeSwitch({
  mode,
  onChange,
}: {
  mode: AssistantMode;
  onChange: (mode: AssistantMode) => void;
}) {
  return (
    <Stack
      direction="row"
      role="tablist"
      aria-label="Input mode"
      spacing={0.35}
      sx={{
        bgcolor: tokens.panelRaised,
        border: `1px solid ${tokens.border}`,
        borderRadius: 999,
        p: 0.35,
      }}
    >
      {MODES.map(({ value, label, icon: Icon }) => {
        const active = mode === value;
        return (
          <Box
            key={value}
            component="button"
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(value)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.6,
              px: 1.6,
              py: 0.55,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 12.5,
              letterSpacing: "0.02em",
              fontWeight: active ? 600 : 500,
              color: active ? tokens.text : tokens.muted,
              background: active ? tokens.panel : "transparent",
              boxShadow: active ? "0 1px 3px rgba(16, 24, 40, 0.1)" : "none",
              transition:
                "color 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease",
              "&:hover": { color: tokens.text },
            }}
          >
            <Icon sx={{ fontSize: 15, color: active ? tokens.accentBright : "inherit" }} />
            {label}
          </Box>
        );
      })}
    </Stack>
  );
}