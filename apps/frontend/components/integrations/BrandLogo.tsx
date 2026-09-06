import Box from "@mui/material/Box";

/**
 * Small inline brand marks for the integrations page. MUI's icon set has no
 * Google/LinkedIn/GitHub glyphs, and shipping `react-icons` just for three
 * logos isn't worth a dependency - so these are the real brand paths, rendered
 * at whatever size the tile decides.
 */

export function GoogleLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20c10 0 20-8 20-20 0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#1A73E8"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#E53935"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#4CAF50"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2c-.5.4 6.6-4.8 6.6-14.7 0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export function GmailLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#4caf50"
        d="M45 16.2l-5 2.75-5 4.75L35 40h7c1.66 0 3-1.34 3-3V16.2z"
      />
      <path fill="#1e88e5" d="M3 16.2l3.614 1.71L13 23.7V40H6c-1.66 0-3-1.34-3-3V16.2z" />
      <polygon fill="#e53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17" />
      <path fill="#c62828" d="M3 12.3V16.2l10 7.5V11.1L9.7 9.3C5.2 6.95 3.9 6.8 3.4 9.6c-.1.5-.2 1.7-.4 2.7z" />
      <path fill="#fbc02d" d="M45 12.3l-.1-.1c-.5-2.8-1.9-2.65-6.3-.2L35 11.1v12.6l10-7.5v-3.9z" />
    </svg>
  );
}

export function CalendarLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#fff" d="M0 0h48v48H0z" />
      <path fill="#039be5" d="M6 23h36v19H6z" />
      <path fill="#e53935" d="M42 13v6H6v-6c0-1.7 1.3-3 3-3h30c1.7 0 3 1.3 3 3z" />
      <path fill="#fff" d="M9.5 4h4c.8 0 1.5.7 1.5 1.5v7c0 .8-.7 1.5-1.5 1.5h-4C8.7 14 8 13.3 8 12.5v-7C8 4.7 8.7 4 9.5 4zm25 0h4c.8 0 1.5.7 1.5 1.5v7c0 .8-.7 1.5-1.5 1.5h-4c-.8 0-1.5-.7-1.5-1.5v-7C33 4.7 33.7 4 34.5 4z" />
    </svg>
  );
}

export function LinkedinLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path
        fill="#fff"
        d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S.02 4.88.02 3.5C.02 2.12 1.13 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8h4V24h-4V8zm7.5 0h3.8v2.2h.05c.53-1 1.83-2.2 3.77-2.2 4 0 4.68 2.62 4.68 6V24h-4v-8.5c0-1.9-.03-4.4-2.7-4.4-2.7 0-3.1 2.1-3.1 4.2V24H8V8z"
      />
    </svg>
  );
}

export function GithubLogo({ size = 24, fill = "#fff" }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden focusable="false">
      <path
        fill={fill}
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

export interface BrandTileProps {
  /** Background color of the rounded tile. */
  bg: string;
  children: React.ReactNode;
  size?: number;
}

/** Consistent 44px rounded-square container every service logo sits in. */
export function BrandTile({ bg, children, size = 44 }: BrandTileProps) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "13px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: bg,
      }}
    >
      {children}
    </Box>
  );
}