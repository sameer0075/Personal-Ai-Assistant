"use client";

import { useCallback, useEffect, useState } from "react";
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
import { LinkedinLogo, BrandTile } from "./BrandLogo";
import IntegrationCard, { panelCardSx } from "./IntegrationCard";
import ActionApprovalModal from "../ActionApprovalModal";
import { deleteLinkedinPost, LinkedinPost, listLinkedinPosts, syncLinkedinToRag } from "@/lib/api/linkedin";
import { createLinkedinDraft, PendingAction } from "@/lib/api/actions";
import { disconnectLinkedin, getLinkedinAuthUrl, getLinkedinStatus, LinkedinStatus } from "@/lib/api/linkedin-auth";

const MAX_CHARS = 3000;

export default function LinkedInCard({ onConnectedChange }: { onConnectedChange?: (connected: boolean) => void }) {
  const [status, setStatus] = useState<LinkedinStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);

  const [posts, setPosts] = useState<LinkedinPost[]>([]);
  const [isPostsLoading, setIsPostsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const [commentary, setCommentary] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [deletingUrn, setDeletingUrn] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setStatus(await getLinkedinStatus());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (status?.connected) {
      setPosts([]);
      handleLoadPosts();
    }
    onConnectedChange?.(status?.connected ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  async function handleConnect() {
    setIsWorking(true);
    try {
      const { url } = await getLinkedinAuthUrl();
      window.location.href = url;
    } catch {
      setIsWorking(false);
    }
  }

  async function handleDisconnect() {
    setIsWorking(true);
    try {
      await disconnectLinkedin();
      await refresh();
    } finally {
      setIsWorking(false);
    }
  }

  async function handleLoadPosts() {
    setIsPostsLoading(true);
    setError(null);
    try {
      setPosts(await listLinkedinPosts(15));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setIsPostsLoading(false);
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
      const draft = await createLinkedinDraft({ commentary });
      setPendingAction(draft);
      setReviewOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare post");
    } finally {
      setIsPosting(false);
    }
  }

  function handleDecided(updated: PendingAction) {
    setReviewOpen(false);
    setPendingAction(null);
    if (updated.status === "approved") {
      setCommentary("");
      handleLoadPosts();
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

  const urnShort = status?.personUrn ? `person ${status.personUrn.split(":").pop()}` : null;

  return (
    <>
      <IntegrationCard
        name="LinkedIn"
        tagline="Publish and prune updates your audience actually sees."
        tile={
          <BrandTile bg="#0A66C2">
            <LinkedinLogo />
          </BrandTile>
        }
        connected={status?.connected ?? false}
        statusLabel={urnShort}
        loading={isLoading}
        working={isWorking}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        connectLabel="Connect LinkedIn"
        body={
          <>
            <Stack spacing={1.25}>
              <Typography
                sx={{ fontSize: 12.5, fontWeight: 700, color: tokens.text, fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}
              >
                Compose
              </Typography>

              <Stack
                component="form"
                onSubmit={handlePublish}
                sx={{
                  border: `1px solid ${tokens.border}`,
                  borderRadius: 2.5,
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
                  placeholder="What do you want to publish?"
                  value={commentary}
                  onChange={(e) => e.target.value.length <= MAX_CHARS && setCommentary(e.target.value)}
                  slotProps={{ input: { disableUnderline: true } }}
                  sx={{ "& .MuiInputBase-input": { fontSize: 14, color: tokens.text } }}
                />

                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", mt: 0.5 }}>
                  <Typography sx={{ fontSize: 11.5, color: tokens.mutedDim, fontFamily: "var(--font-mono)" }}>
                    {commentary.length}/{MAX_CHARS}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                      Opens a review step before publishing
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
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Tooltip title="Refresh posts">
                  <span>
                    <IconButton size="small" onClick={handleLoadPosts} disabled={isPostsLoading}>
                      {isPostsLoading ? <CircularProgress size={16} /> : <RefreshRoundedIcon sx={{ fontSize: 17 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Index into knowledge base">
                  <span>
                    <IconButton size="small" onClick={handleSync} disabled={isSyncing}>
                      {isSyncing ? <CircularProgress size={16} /> : <SyncRoundedIcon sx={{ fontSize: 17 }} />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Typography variant="caption" sx={{ color: tokens.mutedDim, alignSelf: "center" }}>
                  Load &amp; index posts
                </Typography>
              </Stack>
            </Stack>

            <Stack spacing={1} divider={<Divider sx={{ borderColor: tokens.border }} />}>
              {posts.length === 0 && !isPostsLoading && (
                <Typography variant="body2" sx={{ color: tokens.muted, fontSize: 12.5 }}>
                  No posts loaded yet — hit refresh. LinkedIn restricts reading full post history via API, so only posts made
                  through this assistant appear.
                </Typography>
              )}
              {posts.map((post) => (
                <Stack key={post.postUrn} direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                  <Stack spacing={0.25} sx={{ pr: 1 }}>
                    <Typography variant="body2" sx={{ color: tokens.text, fontSize: 13 }}>
                      {post.commentary}
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.mutedDim }}>
                      {new Date(post.publishedAt).toLocaleString()}
                    </Typography>
                  </Stack>
                  <IconButton size="small" onClick={() => handleDelete(post.postUrn)} disabled={deletingUrn === post.postUrn}>
                    {deletingUrn === post.postUrn ? (
                      <CircularProgress size={14} />
                    ) : (
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 16, color: tokens.danger }} />
                    )}
                  </IconButton>
                </Stack>
              ))}
            </Stack>

            {(error || syncNote) && (
              <Stack sx={panelCardSx}>
                {error && <Alert severity="error" sx={{ p: 1, fontSize: 12.5 }}>{error}</Alert>}
                {syncNote && <Alert severity="success" sx={{ p: 1, fontSize: 12.5 }}>{syncNote}</Alert>}
              </Stack>
            )}
          </>
        }
      />
      <ActionApprovalModal
        action={pendingAction}
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onDecided={handleDecided}
      />
    </>
  );
}