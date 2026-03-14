"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Wallet, TrendingUp, TrendingDown, ExternalLink, Shield, Check, Lock, Loader2 } from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { fmt } from "@/lib/mock-data";
import { getXrplStatus } from "@/lib/api";
import { adaptSettlementToMPT } from "@/lib/adapters";

type PortfolioMPT = ReturnType<typeof adaptSettlementToMPT>;

export default function PortfolioPage() {
  const [connected, setConnected] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mpts, setMpts] = useState<PortfolioMPT[]>([]);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [xrplConfigured, setXrplConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Fetch real settlement data when wallet is "connected"
  useEffect(() => {
    if (!connected) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getXrplStatus()
      .then((status) => {
        if (cancelled) return;
        setXrplConfigured(status.configured);
        if (!status.configured) {
          setMpts([]);
          setWalletAddress(null);
          return;
        }
        // Extract the first valid wallet address to display
        const walletEntries = Object.values(status.wallets ?? {});
        const firstValid = walletEntries.find(
          (w): w is { address: string; balanceXRP: string; balanceRLUSD: string } =>
            "address" in w
        );
        setWalletAddress(firstValid?.address ?? null);
        const adapted = status.settlements.map(adaptSettlementToMPT);
        setMpts(adapted);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch XRPL status:", err);
        setError("Could not load XRPL data. The backend may be unavailable.");
        setMpts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [connected]);

  const totalTokensHeld = mpts.reduce((a, m) => a + m.tokensHeld, 0);

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

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-36 pb-8">
        {/* Header */}
        <div className={`flex items-center justify-between mb-8 transition-all duration-500 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}>
          <div>
            <h1 className="text-3xl font-display tracking-tight mb-2">Portfolio</h1>
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
            {connected
              ? walletAddress
                ? `${walletAddress.slice(0, 5)}…${walletAddress.slice(-4)}`
                : "Connected"
              : "Connect wallet to view"}
          </button>
        </div>

        {!connected ? (
          <div className={`border border-dashed border-foreground/20 p-16 text-center transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-display mb-2">Connect your XRPL wallet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              View your prediction market positions, SAFE token holdings, P&L, and accredited investor credentials.
            </p>
            <button
              onClick={() => setConnected(true)}
              className="px-8 py-2.5 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all"
            >
              Connect XRPL wallet
            </button>
          </div>
        ) : loading ? (
          <div className={`border border-dashed border-foreground/20 p-16 text-center transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-4 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading portfolio from XRPL...</p>
          </div>
        ) : xrplConfigured === false ? (
          <div className={`border border-dashed border-foreground/20 p-16 text-center transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-display mb-2">XRPL wallets not configured</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              The backend does not have XRPL wallet seeds configured. Set FOUNDER_SEED and AGENT_SEED
              environment variables to enable portfolio tracking.
            </p>
          </div>
        ) : (
          <div className={`space-y-8 transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            {/* Error banner */}
            {error && (
              <div className="border border-red-200 bg-red-50/50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Summary stats */}
            <div className="grid sm:grid-cols-4 gap-4">
              {[
                { label: "Total bet value", value: "N/A" },
                { label: "Unrealized P&L", value: "N/A" },
                { label: "Settlements", value: mpts.length.toString() },
                { label: "SAFE tokens held", value: totalTokensHeld.toString() },
              ].map((stat) => (
                <div key={stat.label} className="border border-foreground/10 p-4 hover:border-foreground/20 transition-all hover:-translate-y-0.5">
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-2xl font-display">{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Prediction market positions */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                Prediction market positions
              </h2>
              <div className="border border-dashed border-foreground/20 p-8 text-center text-sm text-muted-foreground">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-muted-foreground/50" />
                <p>Per-user bet tracking is not yet available.</p>
                <p className="text-xs mt-1">Place bets on open markets to see positions here in a future update.</p>
              </div>
            </section>

            {/* SAFE MPTs */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                SAFE MPT holdings
              </h2>
              {mpts.length > 0 ? (
                <div className="space-y-4">
                  {mpts.map((mpt) => (
                    <div key={mpt.id} className="border border-foreground/10 p-5 hover:border-foreground/20 transition-all">
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
                  No SAFE tokens yet. Settle markets on XRPL to see token holdings here.
                </div>
              )}
            </section>

            {/* Credentials */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                Investor credentials
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="border border-green-200 bg-green-50/50 p-4 hover:bg-green-50 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">Verified Participant</span>
                    <Check className="w-4 h-4 text-green-500 ml-auto" />
                  </div>
                  <p className="text-xs text-green-600">
                    Wallet verified via XRPL · KYC-lite check passed · Active since Jan 2025
                  </p>
                </div>
                <div className="border border-foreground/20 p-4 hover:border-foreground/30 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-muted-foreground">Accredited Investor</span>
                    <Lock className="w-4 h-4 text-muted-foreground ml-auto" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Required to participate in rounds over $500K valuation cap.
                  </p>
                  <button className="text-xs border border-foreground/20 px-3 py-1.5 hover:bg-foreground/5 transition-all group">
                    Start verification <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
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
