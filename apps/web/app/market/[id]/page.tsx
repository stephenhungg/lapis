"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Github, Twitter, Globe, ExternalLink, TrendingUp, TrendingDown,
  AlertTriangle, Shield, Bot, ArrowUpRight, Lock
} from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { STARTUPS, fmt } from "@/lib/mock-data";

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-mono font-bold w-7 text-right">{score}</span>
    </div>
  );
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const startup = STARTUPS.find((s) => s.id === id) ?? STARTUPS[0];

  const [betDirection, setBetDirection] = useState<"above" | "below" | null>(null);
  const [betAmount, setBetAmount] = useState("50");
  const [betPlaced, setBetPlaced] = useState(false);
  const [liveVal, setLiveVal] = useState(startup.currentBet);
  const [safeConverted, setSafeConverted] = useState(false);

  // Simulate live valuation ticking
  useEffect(() => {
    if (startup.safeStatus !== "open") return;
    const interval = setInterval(() => {
      setLiveVal((v) => {
        const delta = (Math.random() > 0.45 ? 1 : -1) * Math.floor(Math.random() * 80000);
        return Math.max(startup.valuationCap * 0.6, Math.min(startup.valuationCap * 1.5, v + delta));
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [startup]);

  const chartData = startup.valHistory.map((p) => ({
    ...p,
    value: p.value / 1_000_000,
  }));

  const isSettled = startup.safeStatus === "settled";

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <div className="max-w-7xl mx-auto px-6 pt-36 pb-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors">Markets</Link>
          <span>/</span>
          <span className="text-foreground">{startup.name}</span>
        </div>

        {/* TOP SECTION: Startup info */}
        <div className="border border-foreground/10 p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-display">{startup.name}</h1>
                <span className={`text-xs px-2 py-0.5 font-mono border ${
                  isSettled
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-orange-200 bg-orange-50 text-orange-700"
                }`}>
                  {isSettled ? "Settled" : "Market open"}
                </span>
                {!isSettled && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {startup.hoursLeft}h remaining
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm max-w-xl mb-3">{startup.description}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">{startup.founder}</span>
                <span className="text-muted-foreground">{startup.founderTitle}</span>
                <span className="text-foreground/20 mx-1">·</span>
                <span className="text-muted-foreground">{startup.stage} · Founded {startup.founded}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href={`https://${startup.github}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-foreground/10 px-3 py-1.5 transition-colors">
                <Github className="w-3.5 h-3.5" /> GitHub
              </a>
              <a href={`https://twitter.com/${startup.twitter}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-foreground/10 px-3 py-1.5 transition-colors">
                <Twitter className="w-3.5 h-3.5" /> {startup.twitter}
              </a>
              <a href={`https://${startup.website}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-foreground/10 px-3 py-1.5 transition-colors">
                <Globe className="w-3.5 h-3.5" /> {startup.website}
              </a>
              <Link href={`/report/${startup.id}`}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-foreground/10 px-3 py-1.5 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> Full report
              </Link>
            </div>
          </div>
        </div>

        {/* TWO-COLUMN LAYOUT */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 mb-6">

          {/* LEFT: AI Report Card */}
          <div className="space-y-5">
            {/* Scores */}
            <div className="border border-foreground/10 p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-sm">AI Report Card</h2>
                <Link href={`/report/${startup.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  Full report <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {/* Overall score */}
              <div className="flex items-center gap-4 p-4 bg-foreground/[0.03] border border-foreground/10 mb-5">
                <div className="text-5xl font-display">{startup.scores.overall}</div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Overall score</p>
                  <div className="flex items-center gap-1.5">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 w-4 rounded-sm ${
                          i < Math.round(startup.scores.overall / 10)
                            ? "bg-foreground"
                            : "bg-foreground/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <ScoreBar label="Code quality" score={startup.scores.codeQuality} />
                <ScoreBar label="Team strength" score={startup.scores.team} />
                <ScoreBar label="Traction" score={startup.scores.traction} />
                <ScoreBar label="Social" score={startup.scores.social} />
              </div>
            </div>

            {/* Strengths & Risks */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="border border-foreground/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  <h3 className="text-sm font-semibold">Strengths</h3>
                </div>
                <ul className="space-y-2">
                  {startup.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-green-500 mt-0.5">+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-foreground/10 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                  <h3 className="text-sm font-semibold">Risks</h3>
                </div>
                <ul className="space-y-2">
                  {startup.risks.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-2">
                      <span className="text-amber-500 mt-0.5">−</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Adversarial Auditor */}
            {startup.redFlags.length > 0 ? (
              <div className="border border-red-200 bg-red-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-3.5 h-3.5 text-red-500" />
                  <h3 className="text-sm font-semibold text-red-700">Adversarial Auditor — Red Flags</h3>
                </div>
                <ul className="space-y-2">
                  {startup.redFlags.map((f, i) => (
                    <li key={i} className="text-xs text-red-600 flex gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="border border-green-200 bg-green-50/50 p-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-green-500" />
                  <p className="text-xs text-green-700 font-medium">
                    Adversarial audit passed — no significant red flags detected.
                  </p>
                </div>
              </div>
            )}

            {/* Polymarket macro signals */}
            <div className="border border-foreground/10 p-4">
              <h3 className="text-sm font-semibold mb-3">Polymarket Macro Signals</h3>
              <div className="space-y-2">
                {startup.macroSignals.map((sig, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{sig.label}</span>
                    <span className={`font-mono font-semibold ${
                      sig.direction === "up" ? "text-green-600" :
                      sig.direction === "down" ? "text-red-600" : "text-foreground/60"
                    }`}>
                      {sig.direction === "up" ? "↑" : sig.direction === "down" ? "↓" : "→"} {sig.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Prediction Market */}
          <div className="space-y-4">
            {/* Current valuation */}
            <div className="border border-foreground/10 p-5">
              <p className="text-xs text-muted-foreground font-mono mb-2">
                Crowd valuation
              </p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-5xl font-display tabular-nums">
                  {fmt(isSettled ? startup.valuationCap : liveVal)}
                </span>
                {!isSettled && (
                  <span className="text-xs text-orange-500 font-mono pb-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {startup.bettors} bettors · {fmt(startup.volume)} total volume
              </p>
            </div>

            {/* Chart */}
            <div className="border border-foreground/10 p-4">
              <p className="text-xs text-muted-foreground mb-3 font-mono">Valuation history</p>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="currentColor" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="currentColor" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={["auto", "auto"]} hide />
                  <Tooltip
                    formatter={(v: number) => [`$${v.toFixed(1)}M`, "Valuation"]}
                    contentStyle={{ fontSize: 11, border: "1px solid rgba(0,0,0,0.1)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    fill="url(#valGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Bet panel */}
            {!isSettled ? (
              <div className="border border-foreground/10 p-4">
                <p className="text-sm font-semibold mb-1">Place a bet</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Will this startup raise above or below the current crowd valuation?
                </p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={() => setBetDirection("above")}
                    className={`py-3 text-sm font-bold border transition-all ${
                      betDirection === "above"
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-green-300 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    ABOVE ↑
                  </button>
                  <button
                    onClick={() => setBetDirection("below")}
                    className={`py-3 text-sm font-bold border transition-all ${
                      betDirection === "below"
                        ? "bg-red-500 border-red-500 text-white"
                        : "border-red-300 text-red-700 hover:bg-red-50"
                    }`}
                  >
                    BELOW ↓
                  </button>
                </div>

                <div className="mb-4">
                  <label className="text-xs text-muted-foreground block mb-1.5">Amount (USDC)</label>
                  <input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="w-full border border-foreground/20 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-foreground/50"
                    placeholder="50"
                    min="1"
                  />
                </div>

                {betPlaced ? (
                  <div className="bg-green-50 border border-green-200 p-3 text-center">
                    <p className="text-sm font-semibold text-green-700">Bet placed!</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      ${betAmount} USDC {betDirection === "above" ? "ABOVE" : "BELOW"} {fmt(liveVal)}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => betDirection && setBetPlaced(true)}
                    disabled={!betDirection || !betAmount}
                    className="w-full py-2.5 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Place bet
                  </button>
                )}

                {/* AI agent position */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-foreground/10">
                  <Bot className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    AI agent bet{" "}
                    <span className="font-mono font-semibold text-foreground">$50 ABOVE</span>{" "}
                    at{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {fmt(startup.aiPosition)}
                    </span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="border border-green-200 bg-green-50/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-semibold text-green-700">Market settled</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Final valuation: <span className="font-mono font-bold text-foreground">{fmt(startup.valuationCap)}</span>
                </p>
              </div>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Volume", value: fmt(startup.volume) },
                { label: "Bettors", value: startup.bettors.toString() },
                { label: "Hours left", value: isSettled ? "Closed" : `${startup.hoursLeft}h` },
              ].map((stat) => (
                <div key={stat.label} className="border border-foreground/10 p-3 text-center">
                  <p className="text-xs font-mono font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM: SAFE Conversion Panel */}
        <div className={`border p-6 ${isSettled ? "border-foreground/20" : "border-foreground/10 opacity-60"}`}>
          <div className="flex items-center gap-3 mb-4">
            {isSettled ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <h2 className="font-semibold">SAFE Conversion — Active</h2>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-muted-foreground">
                  SAFE Conversion — Unlocks when market settles
                </h2>
              </>
            )}
          </div>

          {isSettled ? (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Valuation cap", value: fmt(startup.valuationCap) },
                  { label: "Equity offered", value: `${startup.equityOffered}%` },
                  { label: "MPT ticker", value: "SFLW" },
                  { label: "MPT address", value: "rSFLW9K..." },
                ].map((item) => (
                  <div key={item.label} className="border border-foreground/10 p-3">
                    <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-sm font-mono font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mb-6 text-xs text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground mb-1">Escrow conditions</p>
                  <p>Tokens locked 12-month cliff, 4-year vest. Transfer royalty: 2% per trade.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">SAFE deployment</p>
                  <p>Legally binding SAFE deployed on Base via MetaLex. Conversion enforced on-chain.</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">MPT issuance</p>
                  <p>Multi-Purpose Token issued on XRPL mainnet. Each token = proportional equity claim.</p>
                </div>
              </div>
              <button
                onClick={() => setSafeConverted(true)}
                disabled={safeConverted}
                className={`px-8 py-3 text-sm font-bold transition-all ${
                  safeConverted
                    ? "bg-green-500 text-white cursor-default"
                    : "bg-foreground text-background hover:bg-foreground/90"
                }`}
              >
                {safeConverted ? "✓ Tokens converted to equity" : "Convert tokens to equity →"}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Once the {startup.hoursLeft}h prediction market closes, the SAFE terms will activate here.
              Token holders can then convert their positions into real equity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
