"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Github, Twitter, Wallet, AlertTriangle } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import * as api from "@/lib/api";

const ANALYSIS_STEPS = [
  { id: "github", label: "Cloning repository..." },
  { id: "commits", label: "Scanning commit history..." },
  { id: "code", label: "Analyzing code quality & test coverage..." },
  { id: "deps", label: "Auditing dependencies & security..." },
  { id: "traction", label: "Fetching GitHub stars, forks, issues..." },
  { id: "twitter", label: "Analyzing Twitter/X presence & sentiment..." },
  { id: "team", label: "Profiling contributor activity..." },
  { id: "adversarial", label: "Running adversarial audit..." },
  { id: "valuation", label: "Generating valuation estimate..." },
];

// map backend status to step progress
function statusToStep(status: string): number {
  switch (status) {
    case "pending": return 1;
    case "scraping": return 4;
    case "analyzing": return 7;
    case "complete": return ANALYSIS_STEPS.length;
    case "error": return ANALYSIS_STEPS.length;
    default: return 0;
  }
}

type Stage = "form" | "analyzing" | "done";

function ListPageInner() {
  const searchParams = useSearchParams();
  const [walletConnected, setWalletConnected] = useState(false);
  const [github, setGithub] = useState(searchParams.get("github") ?? "");
  const [twitter, setTwitter] = useState("");
  const [description, setDescription] = useState("");
  const [equity, setEquity] = useState("8");
  const [stage, setStage] = useState<Stage>("form");
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // real IDs from backend
  const [reportId, setReportId] = useState<string | null>(null);
  const [marketId, setMarketId] = useState<string | null>(null);

  // real scores from backend
  const [scores, setScores] = useState<{
    codeQuality: number;
    teamStrength: number;
    traction: number;
    socialPresence: number;
    overall: number;
  } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setIsVisible(true);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletConnected || !github.trim()) return;

    setStage("analyzing");
    setAnalyzeError(null);
    setCompletedSteps(0);

    try {
      const result = await api.analyze(github.trim(), twitter.trim() || undefined);
      setReportId(result.id);
      startPolling(result.id);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
      setStage("form");
    }
  }

  function startPolling(id: string) {
    // animate the first step immediately
    setCompletedSteps(1);

    pollRef.current = setInterval(async () => {
      try {
        const result = await api.pollScore(id);
        const step = statusToStep(result.status);
        setCompletedSteps(step);

        if (result.status === "complete" && result.scores) {
          if (pollRef.current) clearInterval(pollRef.current);
          setScores(result.scores);

          // create market automatically
          try {
            const market = await api.createMarket(id);
            setMarketId(market.id);
          } catch {
            // market creation failed, still show done
          }

          setStage("done");
        }

        if (result.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          setAnalyzeError(result.error || "Analysis failed");
          setStage("form");
        }
      } catch {
        // polling error, keep trying
      }
    }, 2000);
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <DashboardNav />

      {/* Subtle background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        {[...Array(10)].map((_, i) => (
          <div
            key={`h-${i}`}
            className="absolute h-px bg-foreground"
            style={{ top: `${10 * (i + 1)}%`, left: 0, right: 0 }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-36 pb-12">
        {stage === "form" && (
          <>
            <h1 className={`text-3xl font-display tracking-tight mb-2 transition-all duration-500 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}>List your startup</h1>
            <p className={`text-muted-foreground mb-8 text-sm transition-all duration-500 delay-75 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}>
              Submit your startup for AI analysis. The report goes live and the prediction market opens automatically.
            </p>

            {analyzeError && (
              <div className="flex gap-3 bg-red-50 border border-red-200 p-4 mb-6">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{analyzeError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className={`space-y-6 transition-all duration-500 delay-100 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}>
              {/* Wallet */}
              <div className="border border-foreground/10 p-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold">XRPL Wallet</label>
                  {walletConnected && (
                    <span className="text-xs text-green-600 font-mono flex items-center gap-1">
                      <Check className="w-3 h-3" /> Connected
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Required to receive MPT tokens when your round closes.
                </p>
                <button
                  type="button"
                  onClick={() => setWalletConnected(!walletConnected)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm border transition-all ${
                    walletConnected
                      ? "border-green-500/30 bg-green-50 text-green-700"
                      : "border-foreground/20 hover:bg-foreground/5"
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  {walletConnected ? "Wallet connected" : "Connect XRPL wallet"}
                </button>
              </div>

              {/* GitHub */}
              <div>
                <label className="text-sm font-semibold block mb-1">
                  GitHub URL <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Must be a public repository. The AI agent will clone and analyze it.
                </p>
                <div className="relative">
                  <Github className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="w-full border border-foreground/20 bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-foreground/50 transition placeholder-muted-foreground"
                    placeholder="https://github.com/your-org/your-repo"
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Twitter */}
              <div>
                <label className="text-sm font-semibold block mb-1">Twitter / X</label>
                <div className="relative">
                  <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    className="w-full border border-foreground/20 bg-background pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-foreground/50 transition placeholder-muted-foreground"
                    placeholder="@yourhandle"
                    value={twitter}
                    onChange={(e) => setTwitter(e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-semibold block mb-1">
                  What does your company do? <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  2–3 sentences. Be specific — vague descriptions score lower.
                </p>
                <textarea
                  className="w-full border border-foreground/20 bg-background px-4 py-2.5 text-sm focus:outline-none focus:border-foreground/50 transition placeholder-muted-foreground resize-none h-24"
                  placeholder="We build X for Y. Our main product does Z..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>

              {/* Equity */}
              <div>
                <label className="text-sm font-semibold block mb-1">
                  Equity offered (%)
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Percentage of company offered in this SAFE round. Typically 5–15%.
                </p>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="0.5"
                    value={equity}
                    onChange={(e) => setEquity(e.target.value)}
                    className="flex-1 cursor-pointer"
                  />
                  <span className="font-mono font-bold text-lg w-16 text-right">{equity}%</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1%</span>
                  <span>20%</span>
                </div>
              </div>

              {/* Warning */}
              <div className="flex gap-3 bg-amber-50 border border-amber-200 p-4">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Once submitted, the AI report is public and permanent. The adversarial auditor will
                  highlight risks and red flags visible to all investors.
                </p>
              </div>

              <button
                type="submit"
                disabled={!walletConnected || !github.trim() || !description.trim()}
                className="w-full py-3.5 bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                Submit & start AI analysis
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </form>
          </>
        )}

        {stage === "analyzing" && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold font-mono text-blue-600">AI agent running</span>
            </div>
            <h1 className="text-3xl font-display mb-2">Analyzing your startup</h1>
            <p className="text-sm text-muted-foreground font-mono mb-8 truncate">{github}</p>

            <div className="space-y-4">
              {ANALYSIS_STEPS.map((step, i) => {
                const done = i < completedSteps;
                const active = i === completedSteps;
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 transition-opacity duration-300 ${
                      i > completedSteps ? "opacity-30" : "opacity-100"
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      {done ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : active ? (
                        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-2 h-2 bg-foreground/20 rounded-full" />
                      )}
                    </div>
                    <span className={`text-sm ${done ? "text-foreground" : active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              <div className="h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${(completedSteps / ANALYSIS_STEPS.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right font-mono">
                {Math.round((completedSteps / ANALYSIS_STEPS.length) * 100)}%
              </p>
            </div>
          </div>
        )}

        {stage === "done" && (
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-3 py-1.5 mb-6">
              <Check className="w-3.5 h-3.5" />
              Analysis complete — market is now open
            </div>

            <h1 className="text-3xl font-display mb-3">Your startup is live</h1>
            <p className="text-sm text-muted-foreground mb-8">
              The AI report card is public. The prediction market just opened — the crowd has 72 hours to price your valuation.
            </p>

            <div className="border border-foreground/10 divide-y divide-foreground/10 mb-8">
              {[
                { label: "Overall score", value: scores ? `${scores.overall} / 100` : "—", highlight: true },
                { label: "Code quality", value: scores ? String(scores.codeQuality) : "—" },
                { label: "Team strength", value: scores ? String(scores.teamStrength) : "—" },
                { label: "Traction", value: scores ? String(scores.traction) : "—" },
                { label: "Social", value: scores ? String(scores.socialPresence) : "—" },
                { label: "Market opens", value: "Now · 72h window" },
                { label: "Equity offered", value: `${equity}%` },
              ].map((row) => (
                <div key={row.label} className={`flex items-center justify-between px-5 py-3 ${row.highlight ? "bg-foreground/[0.03]" : ""}`}>
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className={`text-sm font-mono font-semibold ${row.highlight ? "text-foreground" : "text-foreground/70"}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Link
                href={marketId ? `/market/${marketId}` : `/report/${reportId}`}
                className="flex-1 py-3 bg-foreground text-background text-sm font-semibold text-center hover:bg-foreground/90 transition-colors"
              >
                View your market page →
              </Link>
              <Link
                href={`/report/${reportId}`}
                className="flex-1 py-3 border border-foreground/20 text-sm font-semibold text-center hover:bg-foreground/5 transition-colors"
              >
                See full AI report
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background"><DashboardNav /></div>}>
      <ListPageInner />
    </Suspense>
  );
}
