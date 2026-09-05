import { apiFetch } from "./client";

export interface AgentToolSummary {
  name: string;
  description: string;
  needsApproval: boolean;
}

export interface SpecialistInfo {
  name: string;
  description: string;
  tools: AgentToolSummary[];
}

export interface AgentRoster {
  supervisor: {
    name: string;
    description: string;
    model: string;
    specialistCount: number;
  };
  specialists: SpecialistInfo[];
}

export function getAgentRoster(): Promise<AgentRoster> {
  return apiFetch<AgentRoster>("/agents");
}