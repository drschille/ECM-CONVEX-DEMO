export const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  triage: "Triage",
  in_review: "In Review",
  approved: "Approved",
  implementing: "Implementing",
  verified: "Verified",
  closed: "Closed",
  rejected: "Rejected",
};

export const statusOrder = [
  "draft",
  "submitted",
  "triage",
  "in_review",
  "approved",
  "implementing",
  "verified",
  "closed",
] as const;

export const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
  critical: "Critical",
};

export function fmtDate(value?: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function fmtDateShort(value?: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
