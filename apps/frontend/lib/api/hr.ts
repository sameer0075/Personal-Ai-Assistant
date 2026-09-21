import { API_BASE_URL, apiBlob, apiFetch, apiJson } from "./client";
import type { PendingAction } from "./actions";

export type HrResourceKind = "cv" | "policy" | "job_description" | "other";

export interface HrResource {
  id: string;
  title: string;
  sourceType: "cv" | "general";
  metadata: { resourceKind?: HrResourceKind; [key: string]: unknown };
  createdAt: string;
}

export function listHrResources(): Promise<HrResource[]> {
  return apiFetch<HrResource[]>("/hr/resources");
}

export async function uploadHrResource(file: File, kind: HrResourceKind): Promise<HrResource> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<HrResource>(`/hr/resources?kind=${kind}`, { method: "POST", body: form });
}

export function deleteHrResource(id: string): Promise<void> {
  return apiFetch<void>(`/hr/resources/${id}`, { method: "DELETE" });
}

/** Opens an HR document (CV, policy, ...) in a new tab. */
export async function openHrDocument(documentId: string): Promise<void> {
  // Open the tab synchronously so the popup blocker treats it as user-initiated.
  const tab = window.open("", "_blank");
  try {
    const url = URL.createObjectURL(await apiBlob(`/hr/documents/${documentId}/file`));
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    tab?.close();
    throw err;
  }
}

// ---------------------------------------------------------------- people

export type HrEmployeeStatus = "active" | "on_leave" | "former" | "candidate";

export interface HrEmployee {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: HrEmployeeStatus;
  startDate: string | null;
  resumeDocumentId: string | null;
  resumeFilename: string | null;
}

export interface HrEmployeeInput {
  fullName: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: HrEmployeeStatus;
  startDate: string | null;
}

export function listHrEmployees(): Promise<HrEmployee[]> { return apiFetch<HrEmployee[]>("/hr/employees"); }
export function createHrEmployee(input: HrEmployeeInput): Promise<HrEmployee> { return apiJson<HrEmployee>("/hr/employees", "POST", input); }
export function updateHrEmployee(id: string, input: Partial<HrEmployeeInput>): Promise<HrEmployee> { return apiJson<HrEmployee>(`/hr/employees/${id}`, "PATCH", input); }
export function deleteHrEmployee(id: string): Promise<void> { return apiJson<void>(`/hr/employees/${id}`, "DELETE"); }

function uploadResume<T>(path: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<T>(path, { method: "POST", body: form });
}

export function uploadEmployeeResume(id: string, file: File): Promise<HrEmployee> { return uploadResume<HrEmployee>(`/hr/employees/${id}/resume`, file); }

// ---------------------------------------------------------------- applicants

export type HrApplicantStage = "new" | "screening" | "interview" | "offer" | "hired" | "rejected";

export interface HrApplicant {
  id: string;
  jobId: string | null;
  jobTitle: string | null;
  position: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  coverLetter: string | null;
  notes: string | null;
  source: "manual" | "career_site";
  stage: HrApplicantStage;
  resumeDocumentId: string | null;
  resumeFilename: string | null;
  /** People record this applicant was moved to, if any. */
  employeeId: string | null;
  createdAt: string;
}

export interface HrApplicantInput {
  fullName: string;
  email: string | null;
  phone: string | null;
  jobId: string | null;
  position: string | null;
  coverLetter: string | null;
  notes: string | null;
  stage: HrApplicantStage;
}

export function listHrApplicants(): Promise<HrApplicant[]> { return apiFetch<HrApplicant[]>("/hr/applicants"); }
export function createHrApplicant(input: HrApplicantInput): Promise<HrApplicant> { return apiJson<HrApplicant>("/hr/applicants", "POST", input); }
export function updateHrApplicant(id: string, input: Partial<HrApplicantInput>): Promise<HrApplicant> { return apiJson<HrApplicant>(`/hr/applicants/${id}`, "PATCH", input); }
export function deleteHrApplicant(id: string): Promise<void> { return apiJson<void>(`/hr/applicants/${id}`, "DELETE"); }
export function uploadApplicantResume(id: string, file: File): Promise<HrApplicant> { return uploadResume<HrApplicant>(`/hr/applicants/${id}/resume`, file); }
export function hireHrApplicant(id: string): Promise<HrEmployee> { return apiJson<HrEmployee>(`/hr/applicants/${id}/hire`, "POST"); }

// ---------------------------------------------------------------- jobs

export type HrJobStatus = "draft" | "open" | "closed";
export type HrEmploymentType = "full_time" | "part_time" | "contract" | "internship";

export interface HrJob {
  id: string;
  title: string;
  team: string | null;
  location: string | null;
  employmentType: HrEmploymentType;
  description: string | null;
  status: HrJobStatus;
  applicantCount: number;
  createdAt: string;
}

export interface HrJobInput {
  title: string;
  team: string | null;
  location: string | null;
  employmentType: HrEmploymentType;
  description: string | null;
  status: HrJobStatus;
}

export function listHrJobs(): Promise<HrJob[]> { return apiFetch<HrJob[]>("/hr/jobs"); }
export function createHrJob(input: HrJobInput): Promise<HrJob> { return apiJson<HrJob>("/hr/jobs", "POST", input); }
export function updateHrJob(id: string, input: Partial<HrJobInput>): Promise<HrJob> { return apiJson<HrJob>(`/hr/jobs/${id}`, "PATCH", input); }
export function deleteHrJob(id: string): Promise<void> { return apiJson<void>(`/hr/jobs/${id}`, "DELETE"); }

// ---------------------------------------------------------------- events

export interface HrEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string | null;
  calendarEventId: string | null;
  inviteActionId: string | null;
  inviteStatus: "pending" | "approved" | "rejected" | null;
  inviteResult: { recipients?: number; calendarEventId?: string | null; emailsSent?: number; emailsFailed?: Array<{ email: string; error: string }> } | null;
}

export interface HrEventInput {
  title: string;
  description: string | null;
  eventType: string;
  startsAt: string;
  endsAt: string | null;
}

export function listHrEvents(): Promise<HrEvent[]> { return apiFetch<HrEvent[]>("/hr/events"); }
export function createHrEvent(input: HrEventInput): Promise<HrEvent> { return apiJson<HrEvent>("/hr/events", "POST", input); }
export function updateHrEvent(id: string, input: Partial<HrEventInput>): Promise<HrEvent> { return apiJson<HrEvent>(`/hr/events/${id}`, "PATCH", input); }
export function deleteHrEvent(id: string): Promise<void> { return apiJson<void>(`/hr/events/${id}`, "DELETE"); }

// ---------------------------------------------------------------- career-site intake

export function getHrIntakeToken(): Promise<{ token: string }> { return apiFetch<{ token: string }>("/hr/intake"); }
export function rotateHrIntakeToken(): Promise<{ token: string }> { return apiJson<{ token: string }>("/hr/intake/rotate", "POST"); }

export function careerEndpoints(token: string): { applications: string; jobs: string } {
  const base = `${API_BASE_URL}/public/careers/${token}`;
  return { applications: `${base}/applications`, jobs: `${base}/jobs` };
}

export interface JobDescriptionBrief {
  title: string;
  team?: string | null;
  location?: string | null;
  employmentType?: string | null;
  seniority?: string | null;
  experience?: string | null;
  workMode?: string | null;
  responsibilities?: string | null;
  mustHaveSkills?: string[];
  niceToHaveSkills?: string[];
  companyIntro?: string | null;
  benefits?: string | null;
  salary?: string | null;
  tone?: "professional" | "friendly" | "concise";
}

export function generateJobDescription(brief: JobDescriptionBrief): Promise<{ description: string }> {
  return apiJson<{ description: string }>("/hr/jobs/generate-description", "POST", brief);
}

export interface EventDescriptionBrief {
  title: string;
  eventType?: string | null;
  location?: string | null;
  audience?: string | null;
  purpose?: string | null;
  agenda?: string | null;
  preparation?: string | null;
  host?: string | null;
  tone?: "professional" | "friendly" | "concise";
}

export function generateEventDescription(brief: EventDescriptionBrief): Promise<{ description: string }> {
  return apiJson<{ description: string }>("/hr/events/generate-description", "POST", brief);
}

export interface HrEventInviteInput {
  employeeIds: string[];
  addToCalendar: boolean;
  sendEmail: boolean;
  emailSubject?: string;
  emailBody?: string;
  timeZone?: string;
}

/** Queues the invite for approval - nothing is sent until it's approved. */
export function requestHrEventInvite(eventId: string, input: HrEventInviteInput): Promise<PendingAction> {
  return apiJson<PendingAction>(`/hr/events/${eventId}/invite`, "POST", input);
}
