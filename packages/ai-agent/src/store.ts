import { v4 as uuidv4 } from "uuid";
import type { ReportCard } from "@publicround/shared";

const reports = new Map<string, ReportCard>();

export function createReport(githubUrl: string): ReportCard {
  const report: ReportCard = {
    id: uuidv4(),
    githubUrl,
    status: "pending",
    scores: null,
    summary: null,
    strengths: [],
    weaknesses: [],
    githubData: null,
    socialData: null,
    adversarialReport: null,
    createdAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  };
  reports.set(report.id, report);
  return report;
}

export function updateReport(
  id: string,
  updates: Partial<ReportCard>
): ReportCard {
  const report = reports.get(id);
  if (!report) throw new Error(`Report not found: ${id}`);
  const updated = { ...report, ...updates };
  reports.set(id, updated);
  return updated;
}

export function getReport(id: string): ReportCard | undefined {
  return reports.get(id);
}
