import { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../modules/auth/auth.middleware.js";
import { ingestFile } from "../modules/rag/ingest.service.js";
import { documentRepository } from "../modules/rag/document.repository.js";
import {
  createApplicant,
  createEmployee,
  createHrEvent,
  createJob,
  deleteApplicant,
  deleteEmployee,
  deleteHrEvent,
  deleteJob,
  getHrDocumentFile,
  getHrEvent,
  getInviteRecipients,
  hasGoogleConnected,
  linkEventInvite,
  getIntakeToken,
  getPersonName,
  hireApplicant,
  listApplicants,
  listEmployees,
  listHrEvents,
  listJobs,
  rotateIntakeToken,
  setResume,
  updateApplicant,
  updateEmployee,
  updateHrEvent,
  updateJob,
} from "../modules/hr/hr.service.js";
import { generateJobDescription } from "../modules/hr/job-description.service.js";
import { generateEventDescription } from "../modules/hr/event-description.service.js";
import { createHrEventInviteDraft } from "../modules/actions/pending-actions.service.js";

export const hrRoutes = Router();

export const hrUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const RESUME_EXTENSIONS = new Set(["pdf", "docx", "txt"]);

export function isSupportedResume(filename: string): boolean {
  return RESUME_EXTENSIONS.has(filename.split(".").pop()?.toLowerCase() ?? "");
}

/** Empty form fields arrive as "" - treat them as "clear this value". */
const blankToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);
const optionalText = (max: number) => z.preprocess(blankToNull, z.string().trim().max(max).nullable().optional());
const optionalEmail = z.preprocess(blankToNull, z.string().trim().email().max(254).nullable().optional());
const optionalDate = z.preprocess(blankToNull, z.string().date().nullable().optional());
const optionalId = z.preprocess(blankToNull, z.string().uuid().nullable().optional());

const employeeStatus = z.enum(["active", "on_leave", "former", "candidate"]);
const applicantStage = z.enum(["new", "screening", "interview", "offer", "hired", "rejected"]);
const jobStatus = z.enum(["draft", "open", "closed"]);
const employmentType = z.enum(["full_time", "part_time", "contract", "internship"]);

const employeeInput = z.object({ fullName: z.string().trim().min(1).max(160), email: optionalEmail, phone: optionalText(40), role: optionalText(120), status: employeeStatus.optional(), startDate: optionalDate });
const applicantInput = z.object({ fullName: z.string().trim().min(1).max(160), email: optionalEmail, phone: optionalText(40), jobId: optionalId, position: optionalText(160), coverLetter: optionalText(5000), notes: optionalText(5000), stage: applicantStage.optional() });
const jobInput = z.object({ title: z.string().trim().min(1).max(160), team: optionalText(120), location: optionalText(120), employmentType: employmentType.optional(), description: optionalText(10000), status: jobStatus.optional() });
const eventInput = z.object({ title: z.string().trim().min(1).max(160), description: optionalText(5000), eventType: z.string().trim().max(80).optional(), startsAt: z.string().datetime({ offset: true }), endsAt: z.preprocess(blankToNull, z.string().datetime({ offset: true }).nullable().optional()) });
const resourceQuery = z.object({ kind: z.enum(["cv", "policy", "job_description", "other"]).default("other") });

function sendError(res: Response, err: unknown, fallback: string, status = 400): void {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.errors.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ") });
    return;
  }
  const message = err instanceof Error ? err.message : fallback;
  res.status(/not found/i.test(message) ? 404 : status).json({ error: message });
}

/** Indexes an uploaded CV into the workspace knowledge base and links it to the person. */
export async function ingestResume(params: {
  userId: string;
  workspaceId: string;
  kind: "employee" | "applicant";
  personId: string;
  personName: string;
  file: Express.Multer.File;
  intake?: string;
}): Promise<void> {
  const { documentId } = await ingestFile({
    userId: params.userId,
    workspaceId: params.workspaceId,
    buffer: params.file.buffer,
    filename: params.file.originalname,
    sourceType: "cv",
    metadata: {
      department: "hr",
      resourceKind: "cv",
      personType: params.kind,
      personId: params.personId,
      personName: params.personName,
      ...(params.intake ? { intake: params.intake } : {}),
    },
  });
  await setResume(params.workspaceId, params.kind, params.personId, documentId);
}

function resumeUploadHandler(kind: "employee" | "applicant") {
  return async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ error: "Choose a PDF, DOCX, or TXT file first." });
      if (!isSupportedResume(req.file.originalname)) return res.status(400).json({ error: "CVs must be PDF, DOCX, or TXT files." });
      const personName = await getPersonName(req.workspaceId!, kind, req.params.id);
      if (!personName) return res.status(404).json({ error: `${kind === "employee" ? "Employee" : "Applicant"} not found` });
      await ingestResume({ userId: req.userId!, workspaceId: req.workspaceId!, kind, personId: req.params.id, personName, file: req.file });
      const rows = kind === "employee" ? await listEmployees(req.workspaceId!) : await listApplicants(req.workspaceId!);
      res.json(rows.find((row) => row.id === req.params.id));
    } catch (err) {
      sendError(res, err, "Could not attach CV", 422);
    }
  };
}

hrRoutes.use(requireAuth);

// ---------------------------------------------------------------- documents

hrRoutes.get("/resources", async (req, res) => {
  res.json(await documentRepository.listWorkspaceResources(req.userId!, req.workspaceId!));
});

hrRoutes.post("/resources", hrUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Choose a PDF, DOCX, or TXT file first." });
    const { kind } = resourceQuery.parse(req.query);
    const result = await ingestFile({
      userId: req.userId!,
      workspaceId: req.workspaceId!,
      buffer: req.file.buffer,
      filename: req.file.originalname,
      sourceType: kind === "cv" ? "cv" : "general",
      metadata: { department: "hr", resourceKind: kind },
    });
    res.status(201).json({ id: result.documentId, title: result.title, sourceType: kind === "cv" ? "cv" : "general", metadata: { department: "hr", resourceKind: kind }, createdAt: new Date().toISOString() });
  } catch (err) {
    sendError(res, err, "Could not index HR resource", 422);
  }
});

hrRoutes.delete("/resources/:id", async (req, res) => {
  const deleted = await documentRepository.deleteDocument(req.params.id, req.userId!, req.workspaceId!);
  if (!deleted) return res.status(404).json({ error: "HR resource not found" });
  res.status(204).end();
});

hrRoutes.get("/documents/:id/file", async (req, res) => {
  const file = await getHrDocumentFile(req.workspaceId!, req.params.id);
  if (!file) return res.status(404).json({ error: "File not found" });
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.filename)}"`);
  res.send(file.data);
});

// ---------------------------------------------------------------- people

hrRoutes.get("/employees", async (req, res) => res.json(await listEmployees(req.workspaceId!)));
hrRoutes.post("/employees", async (req, res) => {
  try { res.status(201).json(await createEmployee(req.workspaceId!, employeeInput.parse(req.body))); }
  catch (err) { sendError(res, err, "Could not create employee"); }
});
hrRoutes.patch("/employees/:id", async (req, res) => {
  try { res.json(await updateEmployee(req.workspaceId!, req.params.id, employeeInput.partial().parse(req.body))); }
  catch (err) { sendError(res, err, "Could not update employee"); }
});
hrRoutes.delete("/employees/:id", async (req, res) => {
  try { await deleteEmployee(req.workspaceId!, req.params.id); res.status(204).end(); }
  catch (err) { sendError(res, err, "Could not delete employee"); }
});
hrRoutes.post("/employees/:id/resume", hrUpload.single("file"), resumeUploadHandler("employee"));

// ---------------------------------------------------------------- applicants

hrRoutes.get("/applicants", async (req, res) => res.json(await listApplicants(req.workspaceId!)));
hrRoutes.post("/applicants", async (req, res) => {
  try { res.status(201).json(await createApplicant(req.workspaceId!, applicantInput.parse(req.body))); }
  catch (err) { sendError(res, err, "Could not create applicant"); }
});
hrRoutes.patch("/applicants/:id", async (req, res) => {
  try { res.json(await updateApplicant(req.workspaceId!, req.params.id, applicantInput.partial().parse(req.body))); }
  catch (err) { sendError(res, err, "Could not update applicant"); }
});
hrRoutes.delete("/applicants/:id", async (req, res) => {
  try { await deleteApplicant(req.workspaceId!, req.params.id); res.status(204).end(); }
  catch (err) { sendError(res, err, "Could not delete applicant"); }
});
hrRoutes.post("/applicants/:id/resume", hrUpload.single("file"), resumeUploadHandler("applicant"));
hrRoutes.post("/applicants/:id/hire", async (req, res) => {
  try { res.status(201).json(await hireApplicant(req.workspaceId!, req.params.id)); }
  catch (err) { sendError(res, err, "Could not hire applicant"); }
});

// ---------------------------------------------------------------- jobs

hrRoutes.get("/jobs", async (req, res) => res.json(await listJobs(req.workspaceId!)));
hrRoutes.post("/jobs/generate-description", async (req, res) => {
  try {
    const skills = z.array(z.string().trim().min(1).max(80)).max(30).optional();
    const brief = z.object({
      title: z.string().trim().min(1).max(160),
      team: optionalText(120),
      location: optionalText(120),
      employmentType: optionalText(40),
      seniority: optionalText(60),
      experience: optionalText(80),
      workMode: optionalText(40),
      responsibilities: optionalText(3000),
      mustHaveSkills: skills,
      niceToHaveSkills: skills,
      companyIntro: optionalText(2000),
      benefits: optionalText(2000),
      salary: optionalText(120),
      tone: z.enum(["professional", "friendly", "concise"]).optional(),
    }).parse(req.body);
    res.json({ description: await generateJobDescription(brief) });
  } catch (err) {
    sendError(res, err, "Could not generate a description", 502);
  }
});
hrRoutes.post("/jobs", async (req, res) => {
  try { res.status(201).json(await createJob(req.workspaceId!, jobInput.parse(req.body))); }
  catch (err) { sendError(res, err, "Could not create job"); }
});
hrRoutes.patch("/jobs/:id", async (req, res) => {
  try { res.json(await updateJob(req.workspaceId!, req.params.id, jobInput.partial().parse(req.body))); }
  catch (err) { sendError(res, err, "Could not update job"); }
});
hrRoutes.delete("/jobs/:id", async (req, res) => {
  try { await deleteJob(req.workspaceId!, req.params.id); res.status(204).end(); }
  catch (err) { sendError(res, err, "Could not delete job"); }
});

// ---------------------------------------------------------------- events

hrRoutes.get("/events", async (req, res) => res.json(await listHrEvents(req.workspaceId!)));
hrRoutes.post("/events/generate-description", async (req, res) => {
  try {
    const brief = z.object({
      title: z.string().trim().min(1).max(160),
      eventType: optionalText(80),
      location: optionalText(300),
      audience: optionalText(300),
      purpose: optionalText(1000),
      agenda: optionalText(3000),
      preparation: optionalText(1000),
      host: optionalText(160),
      tone: z.enum(["professional", "friendly", "concise"]).optional(),
    }).parse(req.body);
    res.json({ description: await generateEventDescription(brief) });
  } catch (err) {
    sendError(res, err, "Could not generate a description", 502);
  }
});

/**
 * Queues a calendar invite + email to the chosen employees for human approval.
 * Nothing is sent here - it only happens when the pending action is approved.
 */
hrRoutes.post("/events/:id/invite", async (req, res) => {
  try {
    const input = z.object({
      employeeIds: z.array(z.string().uuid()).min(1, "Choose at least one person").max(200),
      addToCalendar: z.boolean(),
      sendEmail: z.boolean(),
      emailSubject: z.string().trim().max(300).optional(),
      emailBody: z.string().trim().max(20_000).optional(),
      timeZone: z.string().trim().max(64).optional(),
    }).refine((v) => v.addToCalendar || v.sendEmail, "Choose a calendar invite, an email, or both")
      .refine((v) => !v.sendEmail || (v.emailSubject && v.emailBody), "Email subject and message are required")
      .parse(req.body);

    const event = await getHrEvent(req.workspaceId!, req.params.id);
    if (!event) return res.status(404).json({ error: "HR event not found" });
    if (event.inviteStatus === "pending") return res.status(409).json({ error: "An invitation for this event is already waiting for approval." });
    if (!(await hasGoogleConnected(req.workspaceId!))) {
      return res.status(400).json({ error: "Connect a Google account to this Work workspace in Integrations first - invites and emails are sent from it." });
    }

    const recipients = await getInviteRecipients(req.workspaceId!, input.employeeIds);
    if (!recipients.length) return res.status(400).json({ error: "None of the selected people have an email address." });

    const start = new Date(event.startsAt as string);
    const end = event.endsAt ? new Date(event.endsAt as string) : new Date(start.getTime() + 60 * 60 * 1000);
    const action = await createHrEventInviteDraft(req.userId!, req.workspaceId!, {
      hrEventId: event.id as string,
      summary: event.title as string,
      description: (event.description as string | null) ?? undefined,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      timeZone: input.timeZone,
      recipients: recipients.map((r) => ({ employeeId: r.id, name: r.full_name, email: r.email })),
      addToCalendar: input.addToCalendar,
      sendEmail: input.sendEmail,
      emailSubject: input.sendEmail ? input.emailSubject : undefined,
      emailBody: input.sendEmail ? input.emailBody : undefined,
    });
    await linkEventInvite(req.workspaceId!, event.id as string, action.id);
    res.status(201).json(action);
  } catch (err) {
    sendError(res, err, "Could not prepare the invitation");
  }
});
hrRoutes.post("/events", async (req, res) => {
  try { res.status(201).json(await createHrEvent(req.workspaceId!, eventInput.parse(req.body))); }
  catch (err) { sendError(res, err, "Could not create HR event"); }
});
hrRoutes.patch("/events/:id", async (req, res) => {
  try { res.json(await updateHrEvent(req.workspaceId!, req.params.id, eventInput.partial().parse(req.body))); }
  catch (err) { sendError(res, err, "Could not update HR event"); }
});
hrRoutes.delete("/events/:id", async (req, res) => {
  try { await deleteHrEvent(req.workspaceId!, req.params.id); res.status(204).end(); }
  catch (err) { sendError(res, err, "Could not delete HR event"); }
});

// ---------------------------------------------------------------- career-site intake settings

hrRoutes.get("/intake", async (req, res) => {
  try { res.json({ token: await getIntakeToken(req.workspaceId!) }); }
  catch (err) { sendError(res, err, "Could not load career intake"); }
});
hrRoutes.post("/intake/rotate", async (req, res) => {
  try { res.json({ token: await rotateIntakeToken(req.workspaceId!) }); }
  catch (err) { sendError(res, err, "Could not reset career intake link"); }
});
