import { randomBytes } from "node:crypto";
import { pool } from "../../config/database.js";

export type HrEmployeeStatus = "active" | "on_leave" | "former" | "candidate";
export type HrApplicantStage = "new" | "screening" | "interview" | "offer" | "hired" | "rejected";
export type HrJobStatus = "draft" | "open" | "closed";
export type HrEmploymentType = "full_time" | "part_time" | "contract" | "internship";

/**
 * Builds a partial UPDATE from only the keys the caller actually sent, so an
 * explicit null clears a field while an omitted key leaves it untouched
 * (COALESCE-style updates can't tell those two apart).
 */
async function updateRow(
  table: string,
  workspaceId: string,
  id: string,
  columns: Record<string, string>,
  input: Record<string, unknown>,
  returning: string
) {
  const sets: string[] = [];
  const values: unknown[] = [id, workspaceId];
  for (const [key, column] of Object.entries(columns)) {
    if (input[key] === undefined) continue;
    values.push(typeof input[key] === "string" ? (input[key] as string).trim() : input[key]);
    sets.push(`${column} = $${values.length}`);
  }
  if (table !== "hr_events") sets.push("updated_at = now()");
  if (!sets.length) {
    const { rows } = await pool.query(`SELECT ${returning} FROM ${table} WHERE id = $1 AND workspace_id = $2`, values);
    return rows[0] ?? null;
  }
  const { rows } = await pool.query(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE id = $1 AND workspace_id = $2 RETURNING ${returning}`,
    values
  );
  return rows[0] ?? null;
}

/** A resume can be shared by an applicant and the employee they were hired as - only drop it once nothing points at it. */
async function deleteResumeIfUnreferenced(workspaceId: string, documentId: string | null): Promise<void> {
  if (!documentId) return;
  await pool.query(
    `DELETE FROM documents d
     WHERE d.id = $1 AND d.workspace_id = $2
       AND NOT EXISTS (SELECT 1 FROM hr_employees WHERE resume_document_id = d.id)
       AND NOT EXISTS (SELECT 1 FROM hr_applicants WHERE resume_document_id = d.id)`,
    [documentId, workspaceId]
  );
}

// ---------------------------------------------------------------- employees

const EMPLOYEE_FIELDS = `id, full_name AS "fullName", email, phone, role, status, start_date::text AS "startDate", resume_document_id AS "resumeDocumentId",
  (SELECT title FROM documents WHERE id = resume_document_id) AS "resumeFilename"`;

export async function listEmployees(workspaceId: string) {
  const { rows } = await pool.query(`SELECT ${EMPLOYEE_FIELDS} FROM hr_employees WHERE workspace_id = $1 ORDER BY full_name`, [workspaceId]);
  return rows;
}

export async function createEmployee(workspaceId: string, input: { fullName: string; email?: string | null; phone?: string | null; role?: string | null; status?: HrEmployeeStatus; startDate?: string | null }) {
  const { rows } = await pool.query(
    `INSERT INTO hr_employees (workspace_id, full_name, email, phone, role, status, start_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${EMPLOYEE_FIELDS}`,
    [workspaceId, input.fullName.trim(), input.email || null, input.phone || null, input.role || null, input.status ?? "active", input.startDate || null]
  );
  return rows[0];
}

export async function updateEmployee(workspaceId: string, id: string, input: Partial<{ fullName: string; email: string | null; phone: string | null; role: string | null; status: HrEmployeeStatus; startDate: string | null }>) {
  const row = await updateRow(
    "hr_employees",
    workspaceId,
    id,
    { fullName: "full_name", email: "email", phone: "phone", role: "role", status: "status", startDate: "start_date" },
    input,
    EMPLOYEE_FIELDS
  );
  if (!row) throw new Error("Employee not found");
  return row;
}

export async function deleteEmployee(workspaceId: string, id: string): Promise<void> {
  const { rows } = await pool.query<{ resume_document_id: string | null }>(
    "DELETE FROM hr_employees WHERE id = $1 AND workspace_id = $2 RETURNING resume_document_id",
    [id, workspaceId]
  );
  if (!rows[0]) throw new Error("Employee not found");
  await deleteResumeIfUnreferenced(workspaceId, rows[0].resume_document_id);
}

// ---------------------------------------------------------------- applicants

const APPLICANT_FIELDS = `a.id, a.job_id AS "jobId", (SELECT title FROM hr_jobs WHERE id = a.job_id) AS "jobTitle", a.position, a.full_name AS "fullName",
  a.email, a.phone, a.cover_letter AS "coverLetter", a.notes, a.source, a.stage, a.resume_document_id AS "resumeDocumentId",
  (SELECT title FROM documents WHERE id = a.resume_document_id) AS "resumeFilename", a.employee_id AS "employeeId", a.created_at AS "createdAt"`;

export async function listApplicants(workspaceId: string) {
  const { rows } = await pool.query(`SELECT ${APPLICANT_FIELDS} FROM hr_applicants a WHERE a.workspace_id = $1 ORDER BY a.created_at DESC`, [workspaceId]);
  return rows;
}

async function assertJobInWorkspace(workspaceId: string, jobId: string | null | undefined): Promise<void> {
  if (!jobId) return;
  const { rowCount } = await pool.query("SELECT 1 FROM hr_jobs WHERE id = $1 AND workspace_id = $2", [jobId, workspaceId]);
  if (!rowCount) throw new Error("Job not found in this workspace");
}

export async function createApplicant(
  workspaceId: string,
  input: { fullName: string; email?: string | null; phone?: string | null; jobId?: string | null; position?: string | null; coverLetter?: string | null; notes?: string | null; stage?: HrApplicantStage; source?: "manual" | "career_site" }
) {
  await assertJobInWorkspace(workspaceId, input.jobId);
  const { rows } = await pool.query(
    `INSERT INTO hr_applicants AS a (workspace_id, job_id, full_name, email, phone, cover_letter, notes, stage, source, position)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING ${APPLICANT_FIELDS}`,
    [workspaceId, input.jobId || null, input.fullName.trim(), input.email || null, input.phone || null, input.coverLetter || null, input.notes || null, input.stage ?? "new", input.source ?? "manual", input.position || null]
  );
  return rows[0];
}

export async function updateApplicant(
  workspaceId: string,
  id: string,
  input: Partial<{ fullName: string; email: string | null; phone: string | null; jobId: string | null; position: string | null; coverLetter: string | null; notes: string | null; stage: HrApplicantStage }>
) {
  await assertJobInWorkspace(workspaceId, input.jobId);
  const row = await updateRow(
    "hr_applicants AS a",
    workspaceId,
    id,
    { fullName: "full_name", email: "email", phone: "phone", jobId: "job_id", position: "position", coverLetter: "cover_letter", notes: "notes", stage: "stage" },
    input,
    APPLICANT_FIELDS
  );
  if (!row) throw new Error("Applicant not found");
  return row;
}

export async function deleteApplicant(workspaceId: string, id: string): Promise<void> {
  const { rows } = await pool.query<{ resume_document_id: string | null }>(
    "DELETE FROM hr_applicants WHERE id = $1 AND workspace_id = $2 RETURNING resume_document_id",
    [id, workspaceId]
  );
  if (!rows[0]) throw new Error("Applicant not found");
  await deleteResumeIfUnreferenced(workspaceId, rows[0].resume_document_id);
}

/** Moves an applicant into the people directory, carrying their contact details and CV across. */
export async function hireApplicant(workspaceId: string, id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: applicants } = await client.query(
      `UPDATE hr_applicants SET stage = 'hired', updated_at = now() WHERE id = $1 AND workspace_id = $2 AND employee_id IS NULL
       RETURNING full_name, email, phone, resume_document_id, COALESCE((SELECT title FROM hr_jobs WHERE id = job_id), position) AS job_title`,
      [id, workspaceId]
    );
    const applicant = applicants[0];
    if (!applicant) {
      const { rowCount } = await client.query("SELECT 1 FROM hr_applicants WHERE id = $1 AND workspace_id = $2", [id, workspaceId]);
      throw new Error(rowCount ? "This applicant is already in People" : "Applicant not found");
    }
    const { rows } = await client.query(
      `INSERT INTO hr_employees (workspace_id, full_name, email, phone, role, status, start_date, resume_document_id)
       VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_DATE, $6)
       RETURNING ${EMPLOYEE_FIELDS}`,
      [workspaceId, applicant.full_name, applicant.email, applicant.phone, applicant.job_title, applicant.resume_document_id]
    );
    await client.query("UPDATE hr_applicants SET employee_id = $3 WHERE id = $1 AND workspace_id = $2", [id, workspaceId, rows[0].id]);
    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------- resumes

/** Points a person at a newly ingested CV document and drops the one it replaces. */
export async function setResume(workspaceId: string, kind: "employee" | "applicant", id: string, documentId: string): Promise<void> {
  const table = kind === "employee" ? "hr_employees" : "hr_applicants";
  const { rows } = await pool.query<{ previous: string | null }>(
    `UPDATE ${table} t SET resume_document_id = $3, updated_at = now()
     FROM (SELECT resume_document_id AS previous FROM ${table} WHERE id = $1 AND workspace_id = $2) old
     WHERE t.id = $1 AND t.workspace_id = $2
     RETURNING old.previous`,
    [id, workspaceId, documentId]
  );
  if (!rows[0]) {
    await deleteResumeIfUnreferenced(workspaceId, documentId);
    throw new Error(`${kind === "employee" ? "Employee" : "Applicant"} not found`);
  }
  if (rows[0].previous && rows[0].previous !== documentId) await deleteResumeIfUnreferenced(workspaceId, rows[0].previous);
}

export async function getPersonName(workspaceId: string, kind: "employee" | "applicant", id: string): Promise<string | null> {
  const table = kind === "employee" ? "hr_employees" : "hr_applicants";
  const { rows } = await pool.query<{ full_name: string }>(`SELECT full_name FROM ${table} WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
  return rows[0]?.full_name ?? null;
}

/** Original file for any HR document (CVs, policies, other resources) in this workspace. */
export async function getHrDocumentFile(workspaceId: string, documentId: string) {
  const { rows } = await pool.query<{ title: string; mime_type: string | null; file_data: Buffer | null }>(
    `SELECT title, mime_type, file_data FROM documents
     WHERE id = $1 AND workspace_id = $2 AND metadata->>'department' = 'hr' AND file_data IS NOT NULL`,
    [documentId, workspaceId]
  );
  const row = rows[0];
  if (!row?.file_data) return null;
  return { filename: row.title, mimeType: row.mime_type ?? "application/octet-stream", data: row.file_data };
}

// ---------------------------------------------------------------- jobs

const JOB_FIELDS = `j.id, j.title, j.team, j.location, j.employment_type AS "employmentType", j.description, j.status,
  (SELECT count(*)::int FROM hr_applicants WHERE job_id = j.id) AS "applicantCount", j.created_at AS "createdAt"`;

export async function listJobs(workspaceId: string) {
  const { rows } = await pool.query(`SELECT ${JOB_FIELDS} FROM hr_jobs j WHERE j.workspace_id = $1 ORDER BY j.created_at DESC`, [workspaceId]);
  return rows;
}

export async function listOpenJobs(workspaceId: string) {
  const { rows } = await pool.query(
    `SELECT id, title, team, location, employment_type AS "employmentType", description
     FROM hr_jobs WHERE workspace_id = $1 AND status = 'open' ORDER BY created_at DESC`,
    [workspaceId]
  );
  return rows;
}

export async function createJob(workspaceId: string, input: { title: string; team?: string | null; location?: string | null; employmentType?: HrEmploymentType; description?: string | null; status?: HrJobStatus }) {
  const { rows } = await pool.query(
    `INSERT INTO hr_jobs AS j (workspace_id, title, team, location, employment_type, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${JOB_FIELDS}`,
    [workspaceId, input.title.trim(), input.team || null, input.location || null, input.employmentType ?? "full_time", input.description || null, input.status ?? "open"]
  );
  return rows[0];
}

export async function updateJob(workspaceId: string, id: string, input: Partial<{ title: string; team: string | null; location: string | null; employmentType: HrEmploymentType; description: string | null; status: HrJobStatus }>) {
  const row = await updateRow(
    "hr_jobs AS j",
    workspaceId,
    id,
    { title: "title", team: "team", location: "location", employmentType: "employment_type", description: "description", status: "status" },
    input,
    JOB_FIELDS
  );
  if (!row) throw new Error("Job not found");
  return row;
}

export async function deleteJob(workspaceId: string, id: string): Promise<void> {
  const result = await pool.query("DELETE FROM hr_jobs WHERE id = $1 AND workspace_id = $2", [id, workspaceId]);
  if (!result.rowCount) throw new Error("Job not found");
}

// ---------------------------------------------------------------- events

const EVENT_FIELDS = `id, title, description, event_type AS "eventType", starts_at AS "startsAt", ends_at AS "endsAt",
  calendar_event_id AS "calendarEventId", invite_action_id AS "inviteActionId",
  (SELECT status FROM pending_actions WHERE id = invite_action_id) AS "inviteStatus",
  (SELECT result FROM pending_actions WHERE id = invite_action_id) AS "inviteResult"`;

export async function listHrEvents(workspaceId: string) {
  const { rows } = await pool.query(`SELECT ${EVENT_FIELDS} FROM hr_events WHERE workspace_id = $1 ORDER BY starts_at`, [workspaceId]);
  return rows;
}

export async function createHrEvent(workspaceId: string, input: { title: string; description?: string | null; eventType?: string; startsAt: string; endsAt?: string | null }) {
  const { rows } = await pool.query(
    `INSERT INTO hr_events (workspace_id, title, description, event_type, starts_at, ends_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${EVENT_FIELDS}`,
    [workspaceId, input.title.trim(), input.description || null, input.eventType || "general", input.startsAt, input.endsAt || null]
  );
  return rows[0];
}

export async function updateHrEvent(workspaceId: string, id: string, input: Partial<{ title: string; description: string | null; eventType: string; startsAt: string; endsAt: string | null }>) {
  const row = await updateRow(
    "hr_events",
    workspaceId,
    id,
    { title: "title", description: "description", eventType: "event_type", startsAt: "starts_at", endsAt: "ends_at" },
    input,
    EVENT_FIELDS
  );
  if (!row) throw new Error("HR event not found");
  return row;
}

export async function deleteHrEvent(workspaceId: string, id: string): Promise<void> {
  const result = await pool.query("DELETE FROM hr_events WHERE id = $1 AND workspace_id = $2", [id, workspaceId]);
  if (!result.rowCount) throw new Error("HR event not found");
}

// ---------------------------------------------------------------- career-site intake

function newIntakeToken(): string {
  return `hr_${randomBytes(24).toString("base64url")}`;
}

export async function getIntakeToken(workspaceId: string): Promise<string> {
  const { rows } = await pool.query<{ hr_intake_token: string }>(
    `UPDATE workspaces SET hr_intake_token = COALESCE(hr_intake_token, $2)
     WHERE id = $1 AND kind = 'work' RETURNING hr_intake_token`,
    [workspaceId, newIntakeToken()]
  );
  if (!rows[0]) throw new Error("Career intake is only available in a Work workspace");
  return rows[0].hr_intake_token;
}

export async function rotateIntakeToken(workspaceId: string): Promise<string> {
  const { rows } = await pool.query<{ hr_intake_token: string }>(
    `UPDATE workspaces SET hr_intake_token = $2 WHERE id = $1 AND kind = 'work' RETURNING hr_intake_token`,
    [workspaceId, newIntakeToken()]
  );
  if (!rows[0]) throw new Error("Career intake is only available in a Work workspace");
  return rows[0].hr_intake_token;
}

export async function findWorkspaceByIntakeToken(token: string): Promise<{ workspaceId: string; userId: string } | null> {
  const { rows } = await pool.query<{ id: string; user_id: string }>(
    "SELECT id, user_id FROM workspaces WHERE hr_intake_token = $1 AND kind = 'work'",
    [token]
  );
  return rows[0] ? { workspaceId: rows[0].id, userId: rows[0].user_id } : null;
}

// ---------------------------------------------------------------- event invitations

export async function getHrEvent(workspaceId: string, id: string) {
  const { rows } = await pool.query(`SELECT ${EVENT_FIELDS} FROM hr_events WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
  return rows[0] ?? null;
}

/** Employees to invite, restricted to this workspace and to people with an email address. */
export async function getInviteRecipients(workspaceId: string, employeeIds: string[]) {
  const { rows } = await pool.query<{ id: string; full_name: string; email: string; status: HrEmployeeStatus }>(
    `SELECT id, full_name, email, status FROM hr_employees
     WHERE workspace_id = $1 AND id = ANY($2::uuid[]) AND email IS NOT NULL AND email <> ''`,
    [workspaceId, employeeIds]
  );
  return rows;
}

export async function hasGoogleConnected(workspaceId: string): Promise<boolean> {
  const { rowCount } = await pool.query("SELECT 1 FROM google_credentials WHERE workspace_id = $1", [workspaceId]);
  return Boolean(rowCount);
}

export async function linkEventInvite(workspaceId: string, eventId: string, actionId: string): Promise<void> {
  await pool.query("UPDATE hr_events SET invite_action_id = $3 WHERE id = $1 AND workspace_id = $2", [eventId, workspaceId, actionId]);
}
