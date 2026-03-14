"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  Github, ExternalLink, Shield, AlertTriangle, Lock, Check,
  TrendingUp, TrendingDown, Share2, Loader2
} from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { fmt } from "@/lib/mock-data";
import type { Startup } from "@/lib/mock-data";
import type { ReportCard } from "@/lib/api-types";
import { getReport, getReportWithPayment, pollScore, PaywallError } from "@/lib/api";
import type { PaymentDetails } from "@/lib/api";
import type { ReportScores } from "@/lib/api-types";
import { adaptReportToStartup } from "@/lib/adapters";

const PIE_COLORS = ["#1a1a1a", "#555", "#999", "#ccc"];
const SOCIAL_DATA = [
  { month: "Aug", followers: 340, mentions: 18 },
  { month: "Sep", followers: 520, mentions: 32 },
  { month: "Oct", followers: 710, mentions: 44 },
  { month: "Nov", followers: 980, mentions: 71 },
  { month: "Dec", followers: 1230, mentions: 58 },
  { month: "Jan", followers: 1580, mentions: 92 },
  { month: "Feb", followers: 2010, mentions: 115 },
  { month: "Mar", followers: 2480, mentions: 138 },
];

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [startup, setStartup] = useState<Startup | null>(null);
  const [report, setReport] = useState<ReportCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [txHash, setTxHash] = useState("");
  const [payError, setPayError] = useState<string | null>(null);
  const [scores, setScores] = useState<ReportScores | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getReport(id)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setStartup(adaptReportToStartup(r));
        setUnlocked(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof PaywallError) {
          setPaymentDetails(err.paymentDetails);
          // Fetch the free scores endpoint so we can show them above the paywall
          pollScore(id)
            .then((result) => {
              if (cancelled) return;
              if (result.scores) setScores(result.scores);
            })
            .catch(() => { /* scores are best-effort */ });
        } else {
          setError(err.message || "Failed to load report");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  function handleUnlock() {
    if (!txHash.trim()) {
      setPayError("Please enter your XRPL transaction hash.");
      return;
    }
    setPaying(true);
    setPayError(null);

    getReportWithPayment(id, txHash.trim())
      .then((r) => {
        setReport(r);
        setStartup(adaptReportToStartup(r));
        setUnlocked(true);
        setPaymentDetails(null);
      })
      .catch((err) => {
        setPayError(err.message || "Payment verification failed. Check your tx hash and try again.");
      })
      .finally(() => {
        setPaying(false);
      });
  }

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <div className="max-w-5xl mx-auto px-6 pt-36 pb-8 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  // Error state (but not paywall — paywall is handled below)
  if (error || (!startup && !report && !paymentDetails)) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <div className="max-w-5xl mx-auto px-6 pt-36 pb-8 flex flex-col items-center justify-center gap-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-red-600">{error || "Report not found"}</p>
          <Link href="/" className="text-sm underline hover:text-foreground transition-colors">
            Back to markets
          </Link>
        </div>
      </div>
    );
  }

  // Paywall state — show scores (if available) + payment instructions
  if (paymentDetails && !unlocked) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <div className="max-w-5xl mx-auto px-6 pt-36 pb-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/" className="hover:text-foreground transition-colors">Markets</Link>
            <span>/</span>
            <span className="text-foreground">Full report</span>
          </div>

          <h1 className="text-3xl font-display mb-1">AI Report</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Payment required to access the full report.
          </p>

          {/* Scores preview (free) */}
          {scores && (
            <div className="grid sm:grid-cols-5 gap-3 mb-8">
              {[
                { label: "Overall", value: scores.overall },
                { label: "Code", value: scores.codeQuality },
                { label: "Team", value: scores.teamStrength },
                { label: "Traction", value: scores.traction },
                { label: "Social", value: scores.socialPresence },
              ].map((s) => (
                <div key={s.label} className="border border-foreground/10 p-4 text-center">
                  <p className="text-3xl font-display mb-1">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Paywall card */}
          <div className="relative border border-foreground/20 overflow-hidden">
            {/* Blurred preview */}
            <div className="blur-sm pointer-events-none select-none p-6 space-y-6 opacity-60">
              <div className="h-48 bg-foreground/5 rounded" />
              <div className="h-48 bg-foreground/5 rounded" />
              <div className="h-32 bg-foreground/5 rounded" />
            </div>

            {/* Paywall overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm p-8 text-center">
              <Lock className="w-8 h-8 text-muted-foreground mb-4" />
              <h3 className="text-xl font-display mb-2">
                Full report — {paymentDetails.amountXRP} XRP
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                {paymentDetails.instructions || "Send the exact amount to the address below, then paste your transaction hash to unlock."}
              </p>

              {/* Payment details */}
              <div className="bg-foreground/5 border border-foreground/10 p-4 mb-4 text-left w-full max-w-md space-y-2">
                <div>
                  <p className="text-[10px] uppercase font-mono text-muted-foreground mb-0.5">Destination address</p>
                  <p className="text-xs font-mono break-all select-all">{paymentDetails.destination}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-mono text-muted-foreground mb-0.5">Amount</p>
                  <p className="text-xs font-mono">{paymentDetails.amountXRP} XRP</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-mono text-muted-foreground mb-0.5">Network</p>
                  <p className="text-xs font-mono">{paymentDetails.network}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
                {["GitHub activity charts", "Contributor breakdown", "Adversarial audit full findings", "Social metrics over time"].map((item) => (
                  <div key={item} className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-green-500" />
                    {item}
                  </div>
                ))}
              </div>

              {/* Tx hash input */}
              <div className="w-full max-w-md mb-3">
                <input
                  type="text"
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="Paste XRPL transaction hash..."
                  className="w-full px-4 py-2.5 border border-foreground/20 bg-background text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40 transition-colors"
                />
              </div>

              {payError && (
                <p className="text-xs text-red-500 mb-3">{payError}</p>
              )}

              <button
                onClick={handleUnlock}
                disabled={paying}
                className="px-8 py-3 bg-foreground text-background text-sm font-bold hover:bg-foreground/90 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {paying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-background/40 border-t-background rounded-full animate-spin" />
                    Verifying payment...
                  </>
                ) : (
                  "Verify & Unlock"
                )}
              </button>
              <p className="text-xs text-muted-foreground mt-3 font-mono">
                Paid via XRPL · {paymentDetails.amountXRP} XRP · instant access after verification
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // At this point, both startup and report are guaranteed to exist
  // (loading, error, and paywall states are handled above)
  if (!startup || !report) return null;

  // Build chart data from real sources
  const langData = Object.entries(startup.languages).map(([name, pct]) => ({
    name, value: pct,
  }));

  // Contributors from real GitHub data
  const contributors = report.githubData?.contributors ?? [];
  const totalContributions = contributors.reduce((s, c) => s + c.contributions, 0) || 1;
  const contributorData = contributors.slice(0, 4).map((c) => ({
    name: c.login,
    commits: c.contributions,
    pct: Math.round((c.contributions / totalContributions) * 100),
  }));
  // If there are more than 4 contributors, lump the rest into "others"
  if (contributors.length > 4) {
    const othersContributions = contributors.slice(4).reduce((s, c) => s + c.contributions, 0);
    contributorData.push({
      name: "others",
      commits: othersContributions,
      pct: Math.round((othersContributions / totalContributions) * 100),
    });
  }

  // Adversarial audit data
  const adversarial = report.adversarialReport;
  const redFlags = adversarial?.redFlags ?? [];
  const trustScore = adversarial?.trustScore ?? null;
  const overallAssessment = adversarial?.overallAssessment ?? null;

  const valRange = {
    low: startup.valuationCap * 0.7,
    mid: startup.valuationCap,
    high: startup.valuationCap * 1.4,
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <div className="max-w-5xl mx-auto px-6 pt-36 pb-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">Markets</Link>
          <span>/</span>
          <Link href={`/market/${startup.id}`} className="hover:text-foreground transition-colors">{startup.name}</Link>
          <span>/</span>
          <span className="text-foreground">Full report</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display mb-1">{startup.name} — AI Report</h1>
            <p className="text-sm text-muted-foreground">
              Generated by PublicRound AI Agent · {new Date(report.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs border border-foreground/20 px-3 py-1.5 hover:bg-foreground/5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              {copied ? "Copied!" : "Share"}
            </button>
            <Link
              href={`/market/${startup.id}`}
              className="flex items-center gap-1.5 text-xs border border-foreground/20 px-3 py-1.5 hover:bg-foreground/5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Market page
            </Link>
          </div>
        </div>

        {/* Summary scores (always visible) */}
        <div className="grid sm:grid-cols-5 gap-3 mb-8">
          {[
            { label: "Overall", value: startup.scores.overall },
            { label: "Code", value: startup.scores.codeQuality },
            { label: "Team", value: startup.scores.team },
            { label: "Traction", value: startup.scores.traction },
            { label: "Social", value: startup.scores.social },
          ].map((s) => (
            <div key={s.label} className="border border-foreground/10 p-4 text-center">
              <p className="text-3xl font-display mb-1">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Valuation estimate (always visible) */}
        <div className="border border-foreground/10 p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4">Valuation Estimate</h2>
          <div className="flex items-end gap-8 mb-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Bear case</p>
              <p className="text-2xl font-display text-red-600">{fmt(valRange.low)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Base case</p>
              <p className="text-3xl font-display">{fmt(valRange.mid)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Bull case</p>
              <p className="text-2xl font-display text-green-600">{fmt(valRange.high)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Based on comparable pre-seed {startup.stage === "Seed" ? "seed" : "pre-seed"} rounds in the sector,
            GitHub traction metrics, MRR trajectory, and team composition. Bear case assumes competitive
            incumbents block growth. Bull case assumes one enterprise contract closes within 6 months.
          </p>
        </div>

        {/* Full report content (unlocked) */}
        <div className="space-y-6">

            {/* GitHub activity */}
            <div className="border border-foreground/10 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Github className="w-4 h-4" />
                <h2 className="text-sm font-semibold">GitHub Activity — Commit Frequency</h2>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={startup.commitFrequency} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name === "commits" ? "Commits" : name]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="commits" fill="currentColor" fillOpacity={0.8} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Lines: additions vs deletions */}
            <div className="border border-foreground/10 p-5">
              <h2 className="text-sm font-semibold mb-4">Code Changes — Additions vs Deletions</h2>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={startup.commitFrequency} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="additions" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Additions" />
                  <Line type="monotone" dataKey="deletions" stroke="#ef4444" strokeWidth={1.5} dot={false} name="Deletions" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Language distribution + contributor */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-foreground/10 p-5">
                <h2 className="text-sm font-semibold mb-4">Language Distribution</h2>
                <div className="flex items-center gap-4">
                  <PieChart width={120} height={120}>
                    <Pie data={langData} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                      {langData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="space-y-1.5">
                    {langData.map((lang, i) => (
                      <div key={lang.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i] }} />
                        <span className="text-muted-foreground w-20">{lang.name}</span>
                        <span className="font-mono font-semibold">{lang.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border border-foreground/10 p-5">
                <h2 className="text-sm font-semibold mb-4">Contributor Breakdown</h2>
                <div className="space-y-3">
                  {contributorData.map((c) => (
                    <div key={c.name} className="flex items-center gap-3 text-xs">
                      <span className="font-mono w-16 text-muted-foreground truncate">{c.name}</span>
                      <div className="flex-1 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                        <div className="h-full bg-foreground/60 rounded-full" style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className="font-mono font-semibold w-8 text-right">{c.commits}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Social metrics */}
            <div className="border border-foreground/10 p-5">
              <h2 className="text-sm font-semibold mb-4">Social Metrics Over Time</h2>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={SOCIAL_DATA} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="followers" stroke="#1a1a1a" strokeWidth={1.5} dot={false} name="Followers" />
                  <Line yAxisId="right" type="monotone" dataKey="mentions" stroke="#888" strokeWidth={1.5} dot={false} name="Mentions" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Adversarial audit full findings */}
            <div className="border border-foreground/10 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4" />
                <h2 className="text-sm font-semibold">Adversarial Audit — Full Findings</h2>
                {trustScore !== null && (
                  <span className="ml-auto text-xs text-muted-foreground font-mono">Trust score: {trustScore}/100</span>
                )}
              </div>

              {redFlags.length > 0 ? (
                <div className="space-y-3 mb-4">
                  {redFlags.map((f, i) => (
                    <div key={i} className="flex gap-3 bg-red-50 border border-red-100 p-3">
                      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${f.severity === "critical" ? "text-red-500" : f.severity === "warning" ? "text-amber-500" : "text-blue-500"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${f.severity === "critical" ? "text-red-700" : f.severity === "warning" ? "text-amber-700" : "text-blue-700"}`}>
                          {f.flag}
                        </p>
                        <p className={`text-xs mt-1 ${f.severity === "critical" ? "text-red-600" : f.severity === "warning" ? "text-amber-600" : "text-blue-600"}`}>
                          {f.reason}
                        </p>
                        <span className="text-[10px] uppercase font-mono mt-1 inline-block opacity-60">{f.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-green-50 border border-green-100 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="w-4 h-4 text-green-500" />
                    <p className="text-sm font-semibold text-green-700">No critical red flags found</p>
                  </div>
                  <p className="text-xs text-green-600">
                    Commit history is clean, contributor diversity is healthy, and no suspicious patterns were detected.
                  </p>
                </div>
              )}

              {overallAssessment && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">{overallAssessment}</p>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { icon: TrendingUp, color: "text-green-500", label: "Commit consistency", value: `${report.githubData?.totalCommits ?? 0} total commits across ${contributors.length} contributors` },
                  { icon: TrendingUp, color: "text-green-500", label: "Dependency health", value: report.githubData?.hasCi ? "CI configured" : "No CI detected" },
                  { icon: contributors.length <= 2 ? TrendingDown : TrendingUp, color: contributors.length <= 2 ? "text-amber-500" : "text-green-500", label: "Bus factor", value: `${contributors.length} contributor${contributors.length !== 1 ? "s" : ""}` },
                  { icon: TrendingUp, color: report.githubData?.hasLicense ? "text-green-500" : "text-amber-500", label: "License compliance", value: report.githubData?.hasLicense ? "License present" : "No license detected" },
                ].map((item) => (
                  <div key={item.label} className="border border-foreground/10 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                      <p className="text-xs font-semibold">{item.label}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="flex gap-3">
              <Link
                href={`/market/${startup.id}`}
                className="flex-1 py-3 bg-foreground text-background text-sm font-semibold text-center hover:bg-foreground/90 transition-colors"
              >
                Go to prediction market →
              </Link>
              <button
                onClick={handleCopy}
                className="px-6 py-3 border border-foreground/20 text-sm hover:bg-foreground/5 transition-colors flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                {copied ? "Copied!" : "Share report"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
