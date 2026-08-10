// import { createTheme } from "@mui/material/styles";

// export const tokens = {
//   bg: "#0b0f14",
//   panel: "#111823",
//   panelRaised: "#161f2c",
//   border: "#232e3d",
//   text: "#dbe4ee",
//   muted: "#7c8797",
//   mutedDim: "#4b5563",
//   accent: "#2dd4bf",
//   accentBright: "#5eead4",
//   accentDim: "#123b37",
//   accentGlow: "#2dd4bf33",
//   danger: "#ef7166",
//   dangerDim: "#3a1f1d",
// };

// export const theme = createTheme({
//   palette: {
//     mode: "dark",
//     background: { default: tokens.bg, paper: tokens.panel },
//     primary: { main: tokens.accent, contrastText: "#04211d" },
//     error: { main: tokens.danger },
//     text: { primary: tokens.text, secondary: tokens.muted },
//     divider: tokens.border,
//   },
//   shape: { borderRadius: 8 },
//   typography: {
//     fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
//     button: { textTransform: "none", fontWeight: 600 },
//   },
//   components: {
//     MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
//   },
// });

import { createTheme } from "@mui/material/styles";

export const tokens = {
  // VS Code / Cursor inspired
  bg: "#181818",
  sidebar: "#181818",
  activityBar: "#181818",
  editor: "#1e1e1e",
  panel: "#181818",
  panelRaised: "#252526",

  border: "#2b2b2b",
  borderLight: "#333333",

  text: "#cccccc",
  textBright: "#e6e6e6",

  muted: "#858585",
  mutedDim: "#5f5f5f",

  accent: "#007acc",
  accentBright: "#3794ff",
  accentDim: "#094771",

  hover: "#2a2d2e",
  active: "#37373d",

  success: "#89d185",
  warning: "#cca700",
  danger: "#f14c4c",

  terminal: "#181818",
};

export const theme = createTheme({
  palette: {
    mode: "dark",

    background: {
      default: tokens.bg,
      paper: tokens.panel,
    },

    primary: {
      main: tokens.accent,
    },

    error: {
      main: tokens.danger,
    },

    text: {
      primary: tokens.text,
      secondary: tokens.muted,
    },

    divider: tokens.border,
  },

  shape: {
    borderRadius: 2,
  },

  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',

    fontSize: 13,

    button: {
      textTransform: "none",
      fontWeight: 400,
    },
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 3,
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 3,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 0,
        },
      },
    },

    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 4,
          },
        },
      },
    },
  },
});