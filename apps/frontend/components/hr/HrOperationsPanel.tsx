"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import CalendarMonthRoundedIcon from "@mui/icons-material/CalendarMonthRounded";
import FolderOpenRoundedIcon from "@mui/icons-material/FolderOpenRounded";
import GavelRoundedIcon from "@mui/icons-material/GavelRounded";
import PeopleAltRoundedIcon from "@mui/icons-material/PeopleAltRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";
import WorkOutlineRoundedIcon from "@mui/icons-material/WorkOutlineRounded";
import {
  listHrApplicants,
  listHrEmployees,
  listHrEvents,
  listHrJobs,
  listHrResources,
  type HrApplicant,
  type HrEmployee,
  type HrEvent,
  type HrJob,
  type HrResource,
} from "@/lib/api/hr";
import { tokens } from "@/lib/theme";
import PeopleTab from "./PeopleTab";
import ApplicantsTab from "./ApplicantsTab";
import JobsTab from "./JobsTab";
import EventsTab from "./EventsTab";
import DocumentsTab from "./DocumentsTab";

type TabKey = "people" | "applicants" | "jobs" | "events" | "policies" | "others";

function Stat({ icon, value, label, hint }: { icon: ReactNode; value: number; label: string; hint?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 140, border: `1px solid ${tokens.border}`, borderRadius: 2.5, bgcolor: tokens.panel, p: 2 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: tokens.text, lineHeight: 1.1 }}>{value}</Typography>
        <Box sx={{ color: tokens.accent, "& svg": { fontSize: 22 } }}>{icon}</Box>
      </Stack>
      <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: tokens.text, mt: 0.75 }}>{label}</Typography>
      {hint && <Typography sx={{ fontSize: 11.5, color: tokens.muted }}>{hint}</Typography>}
    </Box>
  );
}

export default function HrOperationsPanel() {
  const [tab, setTab] = useState<TabKey>("people");
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [applicants, setApplicants] = useState<HrApplicant[]>([]);
  const [jobs, setJobs] = useState<HrJob[]>([]);
  const [events, setEvents] = useState<HrEvent[]>([]);
  const [resources, setResources] = useState<HrResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [people, pipeline, openings, calendar, docs] = await Promise.all([listHrEmployees(), listHrApplicants(), listHrJobs(), listHrEvents(), listHrResources()]);
        if (cancelled) return;
        setEmployees(people);
        setApplicants(pipeline);
        setJobs(openings);
        setEvents(calendar);
        setResources(docs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load HR data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const policies = resources.filter((r) => r.metadata.resourceKind === "policy");
  const others = resources.filter((r) => ["other", "job_description", undefined].includes(r.metadata.resourceKind));
  const activePeople = employees.filter((e) => e.status === "active").length;
  const newApplicants = applicants.filter((a) => a.stage === "new").length;
  const openJobs = jobs.filter((j) => j.status === "open").length;
  const upcomingEvents = events.filter((e) => Date.parse(e.startsAt) >= Date.now()).length;

  // Derived at render so applicant counts and job titles stay right after
  // pipeline changes, job renames, and job deletions (server nulls job_id).
  const jobsView = useMemo(
    () => jobs.map((job) => ({ ...job, applicantCount: applicants.filter((a) => a.jobId === job.id).length })),
    [jobs, applicants]
  );
  const applicantsView = useMemo(() => {
    const titles = new Map(jobs.map((job) => [job.id, job.title]));
    return applicants.map((a) => ({ ...a, jobId: a.jobId && titles.has(a.jobId) ? a.jobId : null, jobTitle: a.jobId ? titles.get(a.jobId) ?? a.jobTitle : null }));
  }, [jobs, applicants]);

  const tabs: Array<{ key: TabKey; label: string; icon: ReactNode; count: number }> = [
    { key: "people", label: "People", icon: <PeopleAltRoundedIcon />, count: employees.length },
    { key: "applicants", label: "Applicants", icon: <PersonSearchRoundedIcon />, count: applicants.length },
    { key: "jobs", label: "Jobs", icon: <WorkOutlineRoundedIcon />, count: jobs.length },
    { key: "events", label: "Events", icon: <CalendarMonthRoundedIcon />, count: events.length },
    { key: "policies", label: "Policies", icon: <GavelRoundedIcon />, count: policies.length },
    { key: "others", label: "Others", icon: <FolderOpenRoundedIcon />, count: others.length },
  ];

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1.5 }}>
        <Stat icon={<PeopleAltRoundedIcon />} value={activePeople} label="Active people" hint={`${employees.length} in directory`} />
        <Stat icon={<PersonSearchRoundedIcon />} value={newApplicants} label="New applicants" hint={`${applicants.length} in pipeline`} />
        <Stat icon={<WorkOutlineRoundedIcon />} value={openJobs} label="Open jobs" hint={`${jobs.length} total`} />
        <Stat icon={<CalendarMonthRoundedIcon />} value={upcomingEvents} label="Upcoming events" />
      </Stack>

      <Box sx={{ border: `1px solid ${tokens.border}`, borderRadius: 3, bgcolor: tokens.panel, p: { xs: 2, md: 2.5 } }}>
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minHeight: 44, mb: 2.5, borderBottom: `1px solid ${tokens.border}`, "& .MuiTab-root": { minHeight: 44, textTransform: "none", fontWeight: 600, fontSize: 13.5 } }}
        >
          {tabs.map(({ key, label, icon, count }) => (
            <Tab
              key={key}
              value={key}
              iconPosition="start"
              icon={<Box sx={{ display: "flex", "& svg": { fontSize: 18 } }}>{icon}</Box>}
              label={
                <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                  <span>{label}</span>
                  <Box component="span" sx={{ fontSize: 11, fontWeight: 700, px: 0.75, borderRadius: 999, bgcolor: tab === key ? tokens.accentDim : tokens.panelRaised, color: tab === key ? tokens.accentBright : tokens.muted }}>{count}</Box>
                </Stack>
              }
            />
          ))}
        </Tabs>

        {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Stack sx={{ alignItems: "center", py: 6 }}><CircularProgress size={26} sx={{ color: tokens.accent }} /></Stack>
        ) : tab === "people" ? (
          <PeopleTab employees={employees} setEmployees={setEmployees} onError={setError} />
        ) : tab === "applicants" ? (
          <ApplicantsTab
            applicants={applicantsView}
            setApplicants={setApplicants}
            jobs={jobs}
            onHired={(employee) => setEmployees((current) => [...current, employee].sort((a, b) => a.fullName.localeCompare(b.fullName)))}
            onError={setError}
          />
        ) : tab === "jobs" ? (
          <JobsTab jobs={jobsView} setJobs={setJobs} onError={setError} />
        ) : tab === "events" ? (
          <EventsTab events={events} setEvents={setEvents} employees={employees} onError={setError} />
        ) : (
          <DocumentsTab kind={tab === "policies" ? "policy" : "other"} resources={resources} setResources={setResources} onError={setError} />
        )}
      </Box>
    </Stack>
  );
}
