"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CodeRoundedIcon from "@mui/icons-material/CodeRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { careerEndpoints, getHrIntakeToken, rotateHrIntakeToken } from "@/lib/api/hr";
import { tokens } from "@/lib/theme";

function CopyRow({ label, method, value }: { label: string; method: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Box>
      <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: tokens.muted, mb: 0.5 }}>{label}</Typography>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1, border: `1px solid ${tokens.border}`, borderRadius: 2, bgcolor: tokens.bg, pl: 1.25, pr: 0.5, py: 0.25 }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: tokens.accentBright, fontFamily: "monospace" }}>{method}</Typography>
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 12.5, fontFamily: "monospace", color: tokens.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</Typography>
        <Tooltip title={copied ? "Copied" : "Copy"}>
          <IconButton size="small" onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <CheckRoundedIcon sx={{ fontSize: 16, color: tokens.accent }} /> : <ContentCopyRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}

export default function CareerIntakeCard({ onError }: { onError: (message: string) => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [showExample, setShowExample] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    getHrIntakeToken().then(({ token }) => setToken(token)).catch((err) => onError(err instanceof Error ? err.message : "Could not load careers endpoint"));
  }, []);

  async function rotate() {
    if (!window.confirm("Reset the careers link? Websites using the current link will stop working until you update them.")) return;
    setRotating(true);
    try { setToken((await rotateHrIntakeToken()).token); }
    catch (err) { onError(err instanceof Error ? err.message : "Could not reset link"); }
    finally { setRotating(false); }
  }

  const urls = token ? careerEndpoints(token) : null;
  const example = urls ? `<form action="${urls.applications}" method="POST" enctype="multipart/form-data">
  <input name="fullName" required placeholder="Full name" />
  <input name="email" type="email" required placeholder="Email" />
  <input name="phone" placeholder="Phone" />
  <input name="position" placeholder="Position you're applying for" />
  <input name="jobId" type="hidden" value="JOB_ID_FROM_JOBS_ENDPOINT" /> <!-- optional -->
  <textarea name="coverLetter" placeholder="Cover letter"></textarea>
  <input name="resume" type="file" accept=".pdf,.docx,.txt" required />
  <button type="submit">Apply</button>
</form>` : "";

  return (
    <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 3, bgcolor: tokens.panel, p: { xs: 2, md: 2.5 } }}>
      <Stack direction={{ xs: "column", sm: "row" }} sx={{ justifyContent: "space-between", alignItems: { sm: "flex-start" }, gap: 1.5, mb: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
          <Box sx={{ width: 38, height: 38, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: tokens.accentDim, color: tokens.accentBright, flexShrink: 0 }}>
            <LanguageRoundedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: tokens.text }}>Careers endpoint</Typography>
            <Typography sx={{ fontSize: 12.5, color: tokens.muted, mt: 0.25, maxWidth: 560 }}>
              Give this link to any website. Applications it receives show up under Applicants with the CV attached and searchable by the HR assistant.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button size="small" variant="outlined" startIcon={<CodeRoundedIcon />} onClick={() => setShowExample((v) => !v)} disabled={!token}>
            {showExample ? "Hide example" : "Embed example"}
          </Button>
          <Tooltip title="Generate a new link and disable the old one">
            <span>
              <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={() => void rotate()} disabled={!token || rotating} sx={{ color: tokens.muted }}>Reset link</Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {urls ? (
        <Stack spacing={1.25}>
          <CopyRow label="Submit an application (multipart/form-data)" method="POST" value={urls.applications} />
          <CopyRow label="List open jobs (JSON)" method="GET" value={urls.jobs} />
        </Stack>
      ) : (
        <Stack spacing={1.25}><Skeleton variant="rounded" height={38} /><Skeleton variant="rounded" height={38} /></Stack>
      )}

      <Collapse in={showExample}>
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: 12, color: tokens.muted, mb: 0.75 }}>
            Fields: <b>fullName</b> and <b>email</b> are required, <b>resume</b> is a PDF, DOCX, or TXT file (15 MB max). <b>phone</b>, <b>position</b> (free text), <b>coverLetter</b>, and <b>jobId</b> (to link a listed opening) are optional. Each address can submit up to 10 applications every 10 minutes.
          </Typography>
          <Box component="pre" sx={{ m: 0, p: 1.5, borderRadius: 2, bgcolor: "#1a2430", color: "#e6edf3", fontSize: 12, lineHeight: 1.55, overflowX: "auto" }}>{example}</Box>
        </Box>
      </Collapse>
    </Box>
  );
}
