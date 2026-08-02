import { createTheme } from "@mui/material/styles";

/**
 * Design tokens for the assistant UI — light mode.
 *
 * Direction: still the quiet "operator console," just in daylight. Depth
 * comes from layered off-whites (bg → panel → panelRaised) rather than
 * borders on everything, so it doesn't collapse into a flat white page.
 * Teal stays the one accent — status indicator, the message you sent vs.
 * the one you got back, and the send action — everything else stays
 * low-contrast ink-on-paper so the accent keeps its meaning.
 */
export const tokens = {
  bg: "#f4f6f8",
  panel: "#ffffff",
  panelRaised: "#eef1f4",
  panelGlass: "rgba(255, 255, 255, 0.78)",

  border: "#dde3e9",
  borderStrong: "#c7d0da",

  text: "#1a2430",
  muted: "#5c6b7a",
  mutedDim: "#8b96a3",

  accent: "#0f9c8d",
  accentBright: "#0b8377",
  accentDim: "#e3f5f2",
  accentGlow: "rgba(15, 156, 141, 0.18)",

  userTint: "#eaf1f8",
  userBorder: "#cfdcea",

  danger: "#c0392b",
  dangerDim: "#fbeceb",
};

export const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: tokens.bg, paper: tokens.panel },
    primary: { main: tokens.accent, contrastText: "#ffffff" },
    error: { main: tokens.danger },
    text: { primary: tokens.text, secondary: tokens.muted },
    divider: tokens.border,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: "var(--font-body), system-ui, sans-serif",
    h1: { fontFamily: "var(--font-mono), monospace" },
    button: { textTransform: "none", fontWeight: 600 },
    body2: { fontSize: "0.875rem", lineHeight: 1.6 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          transition: "border-color 0.15s ease, background-color 0.15s ease",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.7rem",
          letterSpacing: "0.01em",
        },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        },
      },
    },
  },
});