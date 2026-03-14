import { v4 as uuidv4 } from "uuid";
import type { ReportCard } from "@lapis/shared";
import { redisGet, redisSet } from "./redis.js";

const REPORT_PREFIX = "report:";

export async function createReport(githubUrl: string): Promise<ReportCard> {
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
  await redisSet(REPORT_PREFIX + report.id, report);
  return report;
}

export async function updateReport(
  id: string,
  updates: Partial<ReportCard>
): Promise<ReportCard> {
  const report = await redisGet<ReportCard>(REPORT_PREFIX + id);
  if (!report) throw new Error(`Report not found: ${id}`);
  const updated = { ...report, ...updates };
  await redisSet(REPORT_PREFIX + id, updated);
  return updated;
}

export async function getReport(
  id: string
): Promise<ReportCard | undefined> {
  return redisGet<ReportCard>(REPORT_PREFIX + id);
}
