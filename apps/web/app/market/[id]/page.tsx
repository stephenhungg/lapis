"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Github, Twitter, Globe, ExternalLink, TrendingUp, TrendingDown,
  AlertTriangle, Shield, Bot, ArrowUpRight, Lock, Loader2
} from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { fmt } from "@/lib/adapters";
import type { Startup } from "@/lib/adapters";
import type { ValuationMarket, SettlementResult } from "@/lib/api-types";
import { adaptReportToStartup } from "@/lib/adapters";
import {
  getMarket, getReport, createMarket, placeBet, settleMarket,
  getUserId, ApiError,
} from "@/lib/api";

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

  const [startup, setStartup] = useState<Startup | null>(null);
  const [market, setMarket] = useState<ValuationMarket | null>(null);
  const [settlement, setSettlement] = useState<SettlementResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [betDirection, setBetDirection] = useState<"above" | "below" | null>(null);
  const [betAmount, setBetAmount] = useState("50");
  const [betPlaced, setBetPlaced] = useState(false);
  const [betLoading, setBetLoading] = useState(false);
  const [liveVal, setLiveVal] = useState(0);
  const [valHistory, setValHistory] = useState<{ time: string; value: number }[]>([]);
  const [settleLoading, setSettleLoading] = useState(false);
  const [safeConverted, setSafeConverted] = useState(false);
  const [xrplAddress, setXrplAddress] = useState("");

  const marketIdRef = useRef<string | null>(null);

  // Load saved XRPL address from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem("lapis_xrpl_wallet") || localStorage.getItem("lapis_xrpl_address");
    if (saved) setXrplAddress(saved);
  }, []);

  // Initial data fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let mkt: ValuationMarket;

      // Try fetching as market ID first
      try {
        mkt = await getMarket(id);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // Maybe it's a report ID - try fetching report and creating market
          try {
            const report = await getReport(id);
            mkt = await createMarket(report.id);
          } catch {
            throw new Error("Could not find a market or report for this ID.");
          }
        } else {
          throw err;
        }
      }

      marketIdRef.current = mkt.id;
      setMarket(mkt);

      // Fetch the report for full data
      const report = await getReport(mkt.reportId);
      const adapted = adaptReportToStartup(report, mkt);
      setStartup(adapted);

      const consensusDollars = (mkt.consensusValuation ?? 0) * 1_000_000;
      setLiveVal(consensusDollars);

      // Initialize valHistory from adapted startup + current value
      if (adapted.valHistory.length > 0) {
        setValHistory(adapted.valHistory);
      } else if (consensusDollars > 0) {
        setValHistory([{ time: "now", value: consensusDollars }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market data.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll market data every 5 seconds when market is open
  useEffect(() => {
    if (!marketIdRef.current || market?.status === "closed") return;

    const interval = setInterval(async () => {
      try {
        const mkt = await getMarket(marketIdRef.current!);
        setMarket(mkt);
        const consensusDollars = (mkt.consensusValuation ?? 0) * 1_000_000;
        setLiveVal(consensusDollars);

        if (consensusDollars > 0) {
          setValHistory((prev) => [
            ...prev,
            { time: new Date().toLocaleTimeString(), value: consensusDollars },
          ]);
        }
      } catch {
        // Silently ignore poll errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [market?.status]);

  // Place bet handler
  const handlePlaceBet = async () => {
    if (!betDirection || !betAmount || !marketIdRef.current) return;
    setBetLoading(true);
    try {
      const amount = parseFloat(betAmount);
      // Valuation for the bet: if "above", bet at 110% of current; if "below", bet at 90%
      const valuationInMillions = liveVal / 1_000_000;
      const betValuation = betDirection === "above"
        ? valuationInMillions * 1.1
        : valuationInMillions * 0.9;

      // sync XRPL address to both localStorage keys for cross-page consistency
      if (xrplAddress) {
        localStorage.setItem("lapis_xrpl_address", xrplAddress);
        localStorage.setItem("lapis_xrpl_wallet", xrplAddress);
      }

      const updatedMarket = await placeBet(
        marketIdRef.current,
        getUserId(),
        betValuation,
        amount,
        xrplAddress || undefined
      );
      setMarket(updatedMarket);
      const newConsensus = (updatedMarket.consensusValuation ?? 0) * 1_000_000;
      setLiveVal(newConsensus);
      setBetPlaced(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place bet.");
    } finally {
      setBetLoading(false);
    }
  };

  // Settlement handler
  const handleSettle = async () => {
    if (!marketIdRef.current) return;
    setSettleLoading(true);
    try {
      const result = await settleMarket(marketIdRef.current);
      setSettlement(result);
      // Refresh market data
      const mkt = await getMarket(marketIdRef.current);
      setMarket(mkt);
      if (startup) {
        setStartup({ ...startup, safeStatus: "settled" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Settlement failed.");
    } finally {
      setSettleLoading(false);
    }
  };

  // Compute derived values
  const isSettled = market?.status === "closed" || startup?.safeStatus === "settled";
  const totalVolume = market?.bets.reduce((s, b) => s + b.amount, 0) ?? 0;
  const uniqueBettors = new Set(
    market?.bets.filter((b) => !b.userId.startsWith("ai-agent")).map((b) => b.userId) ?? []
  ).size;
  const openedAt = market?.openedAt ? new Date(market.openedAt).getTime() : Date.now();
  const msLeft = Math.max(0, openedAt + 48 * 60 * 60 * 1000 - Date.now());
  const hoursLeft = Math.round(msLeft / (60 * 60 * 1000));

  const agentValuationDisplay = market?.agentValuation
    ? fmt(market.agentValuation * 1_000_000)
    : "N/A";
  const agentConfidenceDisplay = market?.agentConfidence
    ? `${Math.round(market.agentConfidence)}%`
    : "";

  const chartData = valHistory.map((p) => ({
    ...p,
    value: p.value / 1_000_000,
  }));

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <div className="max-w-7xl mx-auto px-6 pt-36 pb-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground font-mono">Loading market data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !startup) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardNav />
        <div className="max-w-7xl mx-auto px-6 pt-36 pb-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-600 font-mono">{error}</p>
            <button
              onClick={fetchData}
              className="px-4 py-2 border border-foreground/20 text-sm hover:bg-foreground/5 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!startup) return null;

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <div className="max-w-7xl mx-auto px-6 pt-36 pb-8">
        {/* Error banner (non-fatal) */}
        {error && (
          <div className="border border-red-200 bg-red-50/50 p-3 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-xs text-red-400 hover:text-red-600">
              Dismiss
            </button>
          </div>
        )}

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
                    {hoursLeft}h remaining
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
              {startup.twitter && (
                <a href={`https://twitter.com/${startup.twitter}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-foreground/10 px-3 py-1.5 transition-colors">
                  <Twitter className="w-3.5 h-3.5" /> {startup.twitter}
                </a>
              )}
              {startup.website && (
                <a href={`https://${startup.website}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-foreground/10 px-3 py-1.5 transition-colors">
                  <Globe className="w-3.5 h-3.5" /> {startup.website}
                </a>
              )}
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
                      <span className="text-amber-500 mt-0.5">-</span>
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
            {startup.macroSignals.length > 0 && (
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
            )}
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
                {uniqueBettors} bettors · {fmt(totalVolume)} total volume
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

                {betPlaced ? (
                  <div className="bg-green-50 border border-green-200 p-4">
                    <p className="text-sm font-semibold text-green-700 mb-0.5">Bet placed!</p>
                    <p className="text-xs text-green-600 mb-3">
                      ${betAmount} USDC {betDirection === "above" ? "above" : "below"} {fmt(liveVal)}
                    </p>
                    <button
                      onClick={() => { setBetPlaced(false); setBetDirection(null); setBetAmount("50"); }}
                      className="w-full py-2 border border-green-300 text-green-700 text-xs font-semibold hover:bg-green-100 transition-colors"
                    >
                      Place another bet
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <button
                        onClick={() => setBetDirection("above")}
                        className={`py-3 text-sm font-bold border transition-all ${
                          betDirection === "above"
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-green-300 text-green-700 hover:bg-green-50"
                        }`}
                      >
                        Above ↑
                      </button>
                      <button
                        onClick={() => setBetDirection("below")}
                        className={`py-3 text-sm font-bold border transition-all ${
                          betDirection === "below"
                            ? "bg-red-500 border-red-500 text-white"
                            : "border-red-300 text-red-700 hover:bg-red-50"
                        }`}
                      >
                        Below ↓
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

                    <div className="mb-4">
                      <label className="text-xs text-muted-foreground block mb-1.5">XRPL Address (for equity delivery)</label>
                      <input
                        type="text"
                        value={xrplAddress}
                        onChange={(e) => setXrplAddress(e.target.value)}
                        className="w-full border border-foreground/20 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:border-foreground/50"
                        placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Equity tokens will be delivered to this address on settlement
                      </p>
                    </div>

                    <button
                      onClick={handlePlaceBet}
                      disabled={!betDirection || !betAmount || betLoading}
                      className="w-full py-2.5 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {betLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {betLoading ? "Placing bet..." : "Place bet"}
                    </button>
                  </>
                )}

                {/* AI agent position */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-foreground/10">
                  <Bot className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    AI agent valued at{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {agentValuationDisplay}
                    </span>
                    {agentConfidenceDisplay && (
                      <>
                        {" "}with{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {agentConfidenceDisplay}
                        </span>
                        {" "}confidence
                      </>
                    )}
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

            {/* Settle button (only after placing a bet) */}
            {!isSettled && betPlaced && (
              <button
                onClick={handleSettle}
                disabled={settleLoading}
                className="w-full py-3 border border-foreground/20 text-sm font-semibold hover:bg-foreground/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {settleLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {settleLoading ? "Settling on XRPL (~30s)..." : "Settle market on XRPL"}
              </button>
            )}

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Volume", value: fmt(totalVolume) },
                { label: "Bettors", value: uniqueBettors.toString() },
                { label: "Hours left", value: isSettled ? "Closed" : `${hoursLeft}h` },
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
                  {
                    label: "MPT address",
                    value: settlement?.equityToken?.mptIssuanceId
                      ? `${settlement.equityToken.mptIssuanceId.slice(0, 8)}...`
                      : "Pending",
                  },
                  {
                    label: "Escrows",
                    value: settlement?.escrows
                      ? `${settlement.escrows.length} created`
                      : "Pending",
                  },
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
                  <p>
                    {settlement?.safe?.contractAddress
                      ? `Deployed at ${settlement.safe.contractAddress.slice(0, 10)}... on Base.`
                      : "SAFE not deployed (BASE_PRIVATE_KEY not configured)"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">MPT issuance</p>
                  <p>Multi-Purpose Token issued on XRPL mainnet. Each token = proportional equity claim.</p>
                </div>
              </div>
              {settlement?.explorerLinks && settlement.explorerLinks.length > 0 && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-foreground mb-2">XRPL explorer links</p>
                  <div className="flex flex-wrap gap-2">
                    {settlement.explorerLinks.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 underline font-mono"
                      >
                        TX #{i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {settlement?.safe?.baseSepoliaExplorerUrl && (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-foreground mb-2">SAFE contract (Base)</p>
                  <a
                    href={settlement.safe.baseSepoliaExplorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800 underline font-mono"
                  >
                    {settlement.safe.contractAddress}
                  </a>
                </div>
              )}
              {/* Show user's equity position if they participated */}
              {settlement?.escrows && settlement.escrows.length > 0 && (
                <div className="mb-4 border border-green-500/30 bg-green-500/5 p-4">
                  <p className="text-xs font-semibold text-green-600 mb-2">EQUITY POSITIONS</p>
                  {settlement.escrows.map((escrow, i) => (
                    <div key={i} className="flex justify-between items-center text-xs py-1.5 border-b border-foreground/5 last:border-0">
                      <div>
                        <span className="font-mono text-foreground">{escrow.userId.slice(0, 12)}...</span>
                        <span className="text-muted-foreground ml-2">{escrow.sharesAllocated} shares</span>
                      </div>
                      <a
                        href={escrow.explorerLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline font-mono"
                      >
                        {escrow.xrplAddress.slice(0, 8)}...
                      </a>
                    </div>
                  ))}
                </div>
              )}
              <div className={`px-8 py-3 text-sm font-bold text-center ${settlement ? "bg-green-500 text-white" : "bg-foreground/20 text-muted-foreground"}`}>
                {settlement ? "Equity issued on XRPL" : "Market closed — settle to issue equity"}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Once the {hoursLeft}h prediction market closes, the SAFE terms will activate here.
              Token holders can then convert their positions into real equity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
