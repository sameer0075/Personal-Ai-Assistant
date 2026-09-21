import { Router, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { z } from "zod";
import { createApplicant, deleteApplicant, findWorkspaceByIntakeToken, listOpenJobs } from "../modules/hr/hr.service.js";
import { hrUpload, ingestResume, isSupportedResume } from "./hr.routes.js";

/**
 * Public career-site API. Any website can embed a job board / application form
 * against it: the per-workspace intake token in the URL identifies which Work
 * workspace receives the applicant, and resetting that token from the HR page
 * revokes old links. Mounted ahead of the app-wide CORS policy because these
 * requests legitimately come from arbitrary third-party origins.
 */
export const careersRoutes = Router();

careersRoutes.use(cors({ origin: "*", methods: ["GET", "POST", "OPTIONS"] }));

// Small in-memory limiter: plenty for a single-instance deployment. Swap for a
// shared store (Redis) if the API ever runs on more than one node.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_SUBMISSIONS = 10;
const submissions = new Map<string, number[]>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = `${req.ip}:${req.params.token}`;
  const now = Date.now();
  const recent = (submissions.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_SUBMISSIONS) {
    res.status(429).json({ error: "Too many applications from this address. Please try again later." });
    return;
  }
  recent.push(now);
  submissions.set(key, recent);
  if (submissions.size > 10_000) {
    for (const [k, times] of submissions) if (!times.some((at) => now - at < WINDOW_MS)) submissions.delete(k);
  }
  next();
}

const applicationInput = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional(),
  jobId: z.preprocess((v) => (v === "" ? undefined : v), z.string().uuid().optional()),
  position: z.string().trim().max(160).optional(),
  coverLetter: z.string().trim().max(5000).optional(),
});

careersRoutes.get("/:token/jobs", async (req, res, next) => {
  try {
    const workspace = await findWorkspaceByIntakeToken(req.params.token);
    if (!workspace) return res.status(404).json({ error: "Career page not found" });
    res.json(await listOpenJobs(workspace.workspaceId));
  } catch (err) {
    next(err);
  }
});

careersRoutes.post("/:token/applications", rateLimit, hrUpload.single("resume"), async (req, res, next) => {
  const workspace = await findWorkspaceByIntakeToken(req.params.token).catch((err) => { next(err); return undefined; });
  if (workspace === undefined) return;
  if (!workspace) return res.status(404).json({ error: "Career page not found" });

  const parsed = applicationInput.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
  }
  if (!req.file) return res.status(400).json({ error: "resume: attach a PDF, DOCX, or TXT file" });
  if (!isSupportedResume(req.file.originalname)) return res.status(400).json({ error: "resume: must be a PDF, DOCX, or TXT file" });

  let applicantId: string | null = null;
  try {
    const applicant = await createApplicant(workspace.workspaceId, { ...parsed.data, source: "career_site" });
    applicantId = applicant.id as string;
    await ingestResume({
      userId: workspace.userId,
      workspaceId: workspace.workspaceId,
      kind: "applicant",
      personId: applicantId,
      personName: parsed.data.fullName,
      file: req.file,
      intake: "career-site",
    });
    res.status(201).json({ id: applicantId, status: "received" });
  } catch (err) {
    // Don't leave a half-created applicant behind when the CV can't be read.
    if (applicantId) await deleteApplicant(workspace.workspaceId, applicantId).catch(() => undefined);
    const message = err instanceof Error ? err.message : "Could not submit application";
    res.status(/not found/i.test(message) ? 400 : 422).json({ error: message });
  }
});
