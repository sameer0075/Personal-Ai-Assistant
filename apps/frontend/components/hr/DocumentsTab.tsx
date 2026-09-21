"use client";

import { useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import { deleteHrResource, openHrDocument, uploadHrResource, type HrResource, type HrResourceKind } from "@/lib/api/hr";
import { tokens } from "@/lib/theme";
import { EmptyState, RecordRow, Toolbar, RESUME_ACCEPT } from "./hrUi";

const COPY: Record<"policy" | "other", { action: string; empty: string; hint: string }> = {
  policy: {
    action: "Upload policy",
    empty: "No policies uploaded",
    hint: "Upload leave, conduct, benefits, or onboarding policies. The HR assistant answers questions from them.",
  },
  other: {
    action: "Upload document",
    empty: "No other HR documents",
    hint: "Templates, handbooks, org charts, or anything else HR should be able to search.",
  },
};

export default function DocumentsTab({ kind, resources, setResources, onError }: {
  kind: "policy" | "other";
  resources: HrResource[];
  setResources: (update: (current: HrResource[]) => HrResource[]) => void;
  onError: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Job descriptions uploaded before Jobs existed are shown with "Others".
  const kinds: HrResourceKind[] = kind === "policy" ? ["policy"] : ["other", "job_description"];
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => kinds.includes(r.metadata.resourceKind ?? "other") && (!q || r.title.toLowerCase().includes(q)));
  }, [resources, search, kind]);

  async function upload(files: FileList) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        try {
          const resource = await uploadHrResource(file, kind);
          setResources((current) => [resource, ...current]);
        } catch (err) {
          onError(`${file.name}: ${err instanceof Error ? err.message : "could not be uploaded"}`);
        }
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(resource: HrResource) {
    if (!window.confirm(`Delete "${resource.title}"? The assistant will no longer be able to search it.`)) return;
    try {
      await deleteHrResource(resource.id);
      setResources((current) => current.filter((r) => r.id !== resource.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not delete document");
    }
  }

  const open = (id: string) => openHrDocument(id).catch((err) => onError(err instanceof Error ? err.message : "Could not open document"));

  return (
    <Stack spacing={2}>
      <input ref={inputRef} hidden multiple type="file" accept={RESUME_ACCEPT} onChange={(e) => e.target.files?.length && void upload(e.target.files)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Search documents" actionLabel={COPY[kind].action} onAction={() => inputRef.current?.click()}>
        {uploading && <CircularProgress size={20} sx={{ color: tokens.accent }} />}
      </Toolbar>

      {visible.length === 0 ? (
        <EmptyState icon={<DescriptionRoundedIcon />} title={search ? "No matches" : COPY[kind].empty} hint={search ? `No documents match "${search}".` : COPY[kind].hint} />
      ) : (
        <Stack spacing={1}>
          {visible.map((resource) => (
            <RecordRow
              key={resource.id}
              onClick={() => void open(resource.id)}
              leading={<Box sx={{ width: 36, height: 36, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: tokens.panelRaised, color: tokens.muted }}><DescriptionRoundedIcon sx={{ fontSize: 19 }} /></Box>}
              title={resource.title}
              subtitle={`Uploaded ${new Date(resource.createdAt).toLocaleDateString()} · searchable by the HR assistant`}
              actions={<>
                <Tooltip title="Open"><IconButton size="small" onClick={() => void open(resource.id)}><OpenInNewRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
                <Tooltip title="Delete"><IconButton size="small" onClick={() => void remove(resource)}><DeleteOutlineRoundedIcon sx={{ fontSize: 17 }} /></IconButton></Tooltip>
              </>}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
