"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, Check, Github, Twitter, Wallet, AlertTriangle } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";

const ANALYSIS_STEPS = [
  { id: "github", label: "Cloning repository...", duration: 800 },
  { id: "commits", label: "Scanning commit history (847 commits)...", duration: 900 },
  { id: "code", label: "Analyzing code quality & test coverage...", duration: 1100 },
  { id: "deps", label: "Auditing dependencies & security...", duration: 700 },
  { id: "traction", label: "Fetching GitHub stars, forks, issues...", duration: 600 },
  { id: "twitter", label: "Analyzing Twitter/X presence & sentiment...", duration: 800 },
  { id: "team", label: "Profiling contributor activity...", duration: 700 },
  { id: "adversarial", label: "Running adversarial audit...", duration: 1200 },
  { id: "valuation", label: "Generating valuation estimate...", duration: 1000 },
];

type Stage = "form" | "analyzing" | "done";

function ListPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [walletConnected, setWalletConnected] = useState(false);
  const [github, setGithub] = useState(searchParams.get("github") ?? "");
  const [twitter, setTwitter] = useState("");
  const [description, setDescription] = useState("");
  const [equity, setEquity] = useState("8");
  const [stage, setStage] = useState<Stage>("form");
  const [completedSteps, setCompletedSteps] = useState<number>(0);
  const [startupId] = useState("neuralEdge");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletConnected || !github.trim()) return;
    setStage("analyzing");
    runAnalysis();
  }

  function runAnalysis() {
    let step = 0;
    let elapsed = 0;
    ANALYSIS_STEPS.forEach((s, i) => {
      elapsed += i === 0 ? 400 : ANALYSIS_STEPS[i - 1].duration;
      setTimeout(() => {
        setCompletedSteps(i + 1);
        if (i === ANALYSIS_STEPS.length - 1) {
          setTimeout(() => router.push(`/market/${startupId}`), 800);
        }
      }, elapsed);
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <div className="max-w-2xl mx-auto px-6 pt-36 pb-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition-colors">PublicRound</Link>
          <span>/</span>
          <span className="text-foreground">List your startup</span>
        </div>

        {stage === "form" && (
          <>
            <h1 className="text-3xl font-display mb-2">List your startup</h1>
            <p className="text-muted-foreground mb-8 text-sm">
              Submit your startup for AI analysis. The report goes live and the prediction market opens automatically.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Wallet */}
              <div className="border border-foreground/10 p-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-semibold">XRPL Wallet</label>
                  {walletConnected && (
                    <span className="text-xs text-green-600 font-mono flex items-center gap-1">
                      <Check className="w-3 h-3" /> r4xK9…F2mP
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
                className="w-full py-3.5 bg-foreground text-background font-semibold text-sm hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Submit & start AI analysis
                <ArrowRight className="w-4 h-4" />
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
                { label: "Overall score", value: "84 / 100", highlight: true },
                { label: "Code quality", value: "87" },
                { label: "Team strength", value: "74" },
                { label: "Traction", value: "91" },
                { label: "Social", value: "78" },
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
                href={`/market/${startupId}`}
                className="flex-1 py-3 bg-foreground text-background text-sm font-semibold text-center hover:bg-foreground/90 transition-colors"
              >
                View your market page →
              </Link>
              <Link
                href={`/report/${startupId}`}
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
