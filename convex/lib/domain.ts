import type { Doc } from "../_generated/dataModel";

export const roles = ["admin", "engineer", "approver", "viewer"] as const;
export type Role = (typeof roles)[number];

export const lifecycleStates = ["draft", "released", "obsolete"] as const;
export type LifecycleState = (typeof lifecycleStates)[number];

export const crStatuses = [
  "draft",
  "submitted",
  "triage",
  "in_review",
  "approved",
  "implementing",
  "verified",
  "closed",
  "rejected",
] as const;
export type ChangeRequestStatus = (typeof crStatuses)[number];

export const priorities = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof priorities)[number];

export const changeTypes = ["design", "process", "software", "document", "other"] as const;
export type ChangeType = (typeof changeTypes)[number];

type TransitionRule = {
  to: ChangeRequestStatus;
  allowedRoles: Role[];
};

const workflowRules: Record<ChangeRequestStatus, TransitionRule[]> = {
  draft: [{ to: "submitted", allowedRoles: ["admin", "engineer"] }],
  submitted: [
    { to: "triage", allowedRoles: ["admin", "approver"] },
    { to: "rejected", allowedRoles: ["admin", "approver"] },
  ],
  triage: [{ to: "in_review", allowedRoles: ["admin", "approver"] }],
  in_review: [
    { to: "approved", allowedRoles: ["admin", "approver"] },
    { to: "rejected", allowedRoles: ["admin", "approver"] },
  ],
  approved: [{ to: "implementing", allowedRoles: ["admin", "engineer"] }],
  implementing: [{ to: "verified", allowedRoles: ["admin", "engineer", "approver"] }],
  verified: [{ to: "closed", allowedRoles: ["admin", "approver"] }],
  closed: [],
  rejected: [],
};

export function canTransitionStatus(
  from: ChangeRequestStatus,
  to: ChangeRequestStatus,
  role: Role,
): boolean {
  return workflowRules[from].some((rule) => rule.to === to && rule.allowedRoles.includes(role));
}

export function getAllowedTransitions(
  from: ChangeRequestStatus,
  role: Role,
): ChangeRequestStatus[] {
  return workflowRules[from]
    .filter((rule) => rule.allowedRoles.includes(role))
    .map((rule) => rule.to);
}

export function parseMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9._-]{2,80})/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

export function computeStatusSlaDueAt(
  status: ChangeRequestStatus,
  fromTime: number,
  dueDate?: number,
): number | undefined {
  if (dueDate) {
    return dueDate;
  }
  const hoursByStatus: Partial<Record<ChangeRequestStatus, number>> = {
    submitted: 24,
    triage: 48,
    in_review: 72,
    approved: 120,
    implementing: 168,
    verified: 72,
  };
  const hours = hoursByStatus[status];
  return hours ? fromTime + hours * 60 * 60 * 1000 : undefined;
}

export function incrementRevision(current: string): string {
  const trimmed = current.trim();
  if (/^\d+$/.test(trimmed)) {
    const width = trimmed.length;
    return String(Number(trimmed) + 1).padStart(width, "0");
  }
  if (/^[A-Z]$/.test(trimmed)) {
    return String.fromCharCode(trimmed.charCodeAt(0) + 1);
  }
  if (/^[A-Z]\d+$/.test(trimmed)) {
    const prefix = trimmed[0];
    const num = trimmed.slice(1);
    return `${prefix}${String(Number(num) + 1).padStart(num.length, "0")}`;
  }
  return `${trimmed}.1`;
}

export function toSearchText(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isTerminalStatus(status: Doc<"changeRequests">["status"]): boolean {
  return status === "closed" || status === "rejected";
}
