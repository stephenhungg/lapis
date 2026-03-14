"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, TrendingDown, ExternalLink, Shield, Check, Lock } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { PORTFOLIO_POSITIONS, PORTFOLIO_MPTS, fmt, fmtDelta } from "@/lib/mock-data";

export default function PortfolioPage() {
  const [connected, setConnected] = useState(false);

  const totalPnl = PORTFOLIO_POSITIONS.reduce((acc, p) => acc + p.pnl * p.betAmount / 100, 0);
  const totalBetValue = PORTFOLIO_POSITIONS.reduce((acc, p) => acc + p.betAmount, 0);

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav />

      <div className="max-w-5xl mx-auto px-6 pt-36 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display mb-1">Portfolio</h1>
            <p className="text-sm text-muted-foreground">Your prediction positions, SAFE MPTs, and investor credentials</p>
          </div>
          <button
            onClick={() => setConnected(!connected)}
            className={`flex items-center gap-2 px-4 py-2 border text-sm font-mono transition-all ${
              connected
                ? "border-green-500/30 bg-green-50 text-green-700"
                : "border-foreground/20 hover:bg-foreground/5"
            }`}
          >
            <Wallet className="w-4 h-4" />
            {connected ? "r4xK9…F2mP" : "Connect wallet to view"}
          </button>
        </div>

        {!connected ? (
          <div className="border border-dashed border-foreground/20 p-16 text-center">
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-display mb-2">Connect your XRPL wallet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              View your prediction market positions, SAFE token holdings, P&L, and accredited investor credentials.
            </p>
            <button
              onClick={() => setConnected(true)}
              className="px-8 py-2.5 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
            >
              Connect XRPL wallet
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Summary stats */}
            <div className="grid sm:grid-cols-4 gap-4">
              {[
                { label: "Total bet value", value: `$${totalBetValue}` },
                { label: "Unrealized P&L", value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}` },
                { label: "Active bets", value: PORTFOLIO_POSITIONS.filter(p => p.status === "active").length.toString() },
                { label: "SAFE tokens held", value: PORTFOLIO_MPTS.reduce((a, m) => a + m.tokensHeld, 0).toString() },
              ].map((stat) => (
                <div key={stat.label} className="border border-foreground/10 p-4">
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`text-2xl font-display ${
                    stat.label === "Unrealized P&L"
                      ? totalPnl >= 0 ? "text-green-600" : "text-red-600"
                      : ""
                  }`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Prediction market positions */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                Prediction market positions
              </h2>
              <div className="border border-foreground/10 divide-y divide-foreground/10">
                {/* Table header */}
                <div className="grid grid-cols-7 gap-4 px-4 py-2 text-xs text-muted-foreground font-medium">
                  <span className="col-span-2">Startup</span>
                  <span>Direction</span>
                  <span>Bet at</span>
                  <span>Current</span>
                  <span>Amount</span>
                  <span className="text-right">P&L</span>
                </div>
                {PORTFOLIO_POSITIONS.map((pos) => {
                  const pnlValue = pos.pnl * pos.betAmount / 100;
                  const isWinning = pos.pnl > 0;
                  return (
                    <div key={pos.id} className="grid grid-cols-7 gap-4 px-4 py-4 items-center hover:bg-foreground/[0.02] transition-colors">
                      <div className="col-span-2">
                        <Link
                          href={`/market/${pos.id}`}
                          className="font-semibold text-sm hover:underline flex items-center gap-1"
                        >
                          {pos.name}
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </Link>
                        <span className={`text-xs px-1.5 py-0.5 font-mono mt-0.5 inline-block ${
                          pos.status === "active"
                            ? "bg-orange-50 text-orange-700 border border-orange-200"
                            : "bg-green-50 text-green-700 border border-green-200"
                        }`}>
                          {pos.status === "active" ? "Active" : "Settled"}
                        </span>
                      </div>

                      <div>
                        <span className={`flex items-center gap-1 text-sm font-bold ${
                          pos.direction === "above" ? "text-green-600" : "text-red-600"
                        }`}>
                          {pos.direction === "above"
                            ? <TrendingUp className="w-3.5 h-3.5" />
                            : <TrendingDown className="w-3.5 h-3.5" />
                          }
                          {pos.direction === "above" ? "Above" : "Below"}
                        </span>
                      </div>

                      <span className="text-sm font-mono">{fmt(pos.betValuation)}</span>
                      <span className="text-sm font-mono">{fmt(pos.currentValuation)}</span>
                      <span className="text-sm font-mono">${pos.betAmount}</span>

                      <div className="text-right">
                        <span className={`text-sm font-bold font-mono ${
                          isWinning ? "text-green-600" : "text-red-600"
                        }`}>
                          {isWinning ? "+" : ""}${pnlValue.toFixed(2)}
                        </span>
                        <span className={`block text-xs font-mono ${
                          isWinning ? "text-green-500" : "text-red-500"
                        }`}>
                          {fmtDelta(pos.pnl)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* SAFE MPTs */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                SAFE MPT holdings
              </h2>
              {PORTFOLIO_MPTS.length > 0 ? (
                <div className="space-y-4">
                  {PORTFOLIO_MPTS.map((mpt) => (
                    <div key={mpt.id} className="border border-foreground/10 p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-semibold">{mpt.name}</span>
                            <span className="font-mono text-xs border border-foreground/20 px-2 py-0.5">
                              ${mpt.ticker}
                            </span>
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5">
                              Escrow active
                            </span>
                          </div>
                          <p className="text-xs font-mono text-muted-foreground">{mpt.mptAddress}</p>
                        </div>
                        <Link href={`/market/${mpt.id}`}
                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                          View market <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>

                      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                        {[
                          { label: "Tokens held", value: mpt.tokensHeld.toString() },
                          { label: "Val. cap", value: fmt(mpt.valuationCap) },
                          { label: "Equity claim", value: `${mpt.equity}%` },
                          { label: "Vesting cliff", value: mpt.vestingCliff },
                          { label: "Total vesting", value: mpt.vestingTotal },
                          { label: "SAFE on", value: mpt.safeDeployed },
                        ].map((item) => (
                          <div key={item.label} className="border border-foreground/10 p-2.5">
                            <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                            <p className="text-xs font-mono font-bold">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground bg-foreground/[0.02] border border-foreground/10 p-3">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          Tokens are locked in escrow until vesting cliff. 2% transfer royalty applies to secondary sales.
                          Conversion to real equity available once vesting conditions are met.
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-foreground/20 p-8 text-center text-sm text-muted-foreground">
                  No SAFE tokens yet. Bet on open markets to earn token positions.
                </div>
              )}
            </section>

            {/* Credentials */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                Investor credentials
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="border border-green-200 bg-green-50/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">Verified Participant</span>
                    <Check className="w-4 h-4 text-green-500 ml-auto" />
                  </div>
                  <p className="text-xs text-green-600">
                    Wallet verified via XRPL · KYC-lite check passed · Active since Jan 2025
                  </p>
                </div>
                <div className="border border-foreground/20 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-muted-foreground">Accredited Investor</span>
                    <Lock className="w-4 h-4 text-muted-foreground ml-auto" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Required to participate in rounds over $500K valuation cap.
                  </p>
                  <button className="text-xs border border-foreground/20 px-3 py-1.5 hover:bg-foreground/5 transition-colors">
                    Start verification →
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
