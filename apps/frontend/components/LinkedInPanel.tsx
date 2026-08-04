"use client";

import { useState } from "react";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import Tooltip from "@mui/material/Tooltip";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import ArrowUpwardRoundedIcon from "@mui/icons-material/ArrowUpwardRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { tokens } from "@/lib/theme";
import { createLinkedinPost, deleteLinkedinPost, LinkedinPost, listLinkedinPosts, syncLinkedinToRag } from "@/lib/api/linkedin";

const MAX_CHARS = 3000;

export default function LinkedInPanel() {
  const [posts, setPosts] = useState<LinkedinPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [commentary, setCommentary] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [deletingUrn, setDeletingUrn] = useState<string | null>(null);

  async function handleLoad() {
    setIsLoading(true);
    setError(null);
    try {
      setPosts(await listLinkedinPosts(15));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    setSyncNote(null);
    setError(null);
    try {
      const summary = await syncLinkedinToRag(15);
      setSyncNote(`Indexed ${summary.ingested} new, skipped ${summary.skipped} already-known (of ${summary.found}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync to knowledge base");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    setIsPosting(true);
    setError(null);
    try {
      await createLinkedinPost(commentary);
      setCommentary("");
      handleLoad();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish post");
    } finally {
      setIsPosting(false);
    }
  }

  async function handleDelete(postUrn: string) {
    setDeletingUrn(postUrn);
    setError(null);
    try {
      await deleteLinkedinPost(postUrn);
      setPosts((prev) => prev.filter((p) => p.postUrn !== postUrn));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete post");
    } finally {
      setDeletingUrn(null);
    }
  }

  return (
    <Paper
      elevation={0}
      sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${tokens.border}`, bgcolor: tokens.panel }}
    >
      <Stack spacing={2}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: tokens.text }}>LinkedIn</Typography>

        <Paper
          component="form"
          onSubmit={handlePublish}
          elevation={0}
          sx={{
            border: `1px solid ${tokens.border}`,
            borderRadius: 3,
            bgcolor: tokens.panelRaised,
            px: 2,
            pt: 1.25,
            pb: 1,
            transition: "box-shadow 0.15s ease, border-color 0.15s ease",
            "&:focus-within": { borderColor: tokens.accent, boxShadow: `0 0 0 3px ${tokens.accentGlow}` },
          }}
        >
          <TextField
            fullWidth
            variant="standard"
            multiline
            minRows={3}
            placeholder="What do you want to publish? This posts immediately - there's no draft state."
            value={commentary}
            onChange={(e) => e.target.value.length <= MAX_CHARS && setCommentary(e.target.value)}
            slotProps={{ input: { disableUnderline: true } }}
            sx={{ "& .MuiInputBase-input": { fontSize: 14, color: tokens.text } }}
          />

          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mt: 0.5 }}>
            <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
              {commentary.length}/{MAX_CHARS}
            </Typography>

            <IconButton
              type="submit"
              size="small"
              disabled={isPosting || !commentary.trim()}
              sx={{
                width: 32,
                height: 32,
                background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                color: "#fff",
                "&:hover": {
                  background: `linear-gradient(135deg, ${tokens.accent}, ${tokens.accentBright})`,
                  boxShadow: `0 0 0 4px ${tokens.accentGlow}`,
                },
                "&.Mui-disabled": { background: tokens.panelRaised, color: tokens.mutedDim },
              }}
            >
              {isPosting ? <CircularProgress size={14} sx={{ color: tokens.mutedDim }} /> : <ArrowUpwardRoundedIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Stack>
        </Paper>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <span>
              <IconButton
                size="small"
                onClick={handleLoad}
                disabled={isLoading}
                sx={{ border: `1px solid ${tokens.border}`, borderRadius: 2 }}
              >
                {isLoading ? <CircularProgress size={16} /> : <RefreshRoundedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Index into knowledge base">
            <span>
              <IconButton
                size="small"
                onClick={handleSync}
                disabled={isSyncing}
                sx={{ border: `1px solid ${tokens.border}`, borderRadius: 2 }}
              >
                {isSyncing ? <CircularProgress size={16} /> : <SyncRoundedIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}
        {syncNote && <Alert severity="success">{syncNote}</Alert>}

        <Stack spacing={1} divider={<Divider sx={{ borderColor: tokens.border }} />}>
          {posts.length === 0 && !isLoading && (
            <Typography variant="body2" sx={{ color: tokens.muted }}>
              No posts loaded yet — hit refresh. Only shows posts made through this assistant (LinkedIn restricts
              reading full post history via API).
            </Typography>
          )}
          {posts.map((post) => (
            <Stack
              key={post.postUrn}
              direction="row"
              sx={{ alignItems: "flex-start", justifyContent: "space-between" }}
            >
              <Stack spacing={0.25} sx={{ pr: 1 }}>
                <Typography variant="body2" sx={{ color: tokens.text }}>
                  {post.commentary}
                </Typography>
                <Typography variant="caption" sx={{ color: tokens.mutedDim }}>
                  {new Date(post.publishedAt).toLocaleString()}
                </Typography>
              </Stack>
              <IconButton
                size="small"
                onClick={() => handleDelete(post.postUrn)}
                disabled={deletingUrn === post.postUrn}
              >
                {deletingUrn === post.postUrn ? (
                  <CircularProgress size={14} />
                ) : (
                  <DeleteOutlineRoundedIcon sx={{ fontSize: 18, color: tokens.danger }} />
                )}
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}