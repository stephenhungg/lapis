"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Coins,
  Clock,
  ExternalLink,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2,
  Lock,
  Wallet,
  Info,
} from "lucide-react";
import { DashboardNav } from "@/components/dashboard/nav";
import { WalletModal } from "@/components/wallet-modal";
import { useWallet } from "@/hooks/use-wallet";
import { fmt } from "@/lib/adapters";
import { getXrplStatus } from "@/lib/api";
import type { XrplStatus, SettlementResult } from "@/lib/api-types";

const RIPPLE_EPOCH_OFFSET = 946684800;

function rippleToDate(rippleTimestamp: number): Date {
  return new Date((rippleTimestamp + RIPPLE_EPOCH_OFFSET) * 1000);
}

function truncate(str: string): string {
  if (str.length <= 12) return str;
  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "now";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function VestingProgress({ finishAfter, cancelAfter }: { finishAfter: number | null; cancelAfter: number | null }) {
  const now = Date.now();

  if (finishAfter == null) {
    return <span className="text-xs text-muted-foreground font-mono">No vesting</span>;
  }

  const unlockDate = rippleToDate(finishAfter);
  const unlockMs = unlockDate.getTime();
  const isUnlocked = now >= unlockMs;

  if (isUnlocked) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
        <CheckCircle className="w-3 h-3" />
        Unlocked
      </span>
    );
  }

  // Calculate progress: use settledAt or a rough 90-day window for the bar
  const totalDuration = cancelAfter
    ? rippleToDate(cancelAfter).getTime() - rippleToDate(finishAfter).getTime() + (unlockMs - now)
    : 90 * 24 * 60 * 60 * 1000; // fallback 90 days
  const remaining = unlockMs - now;
  const elapsed = totalDuration - remaining;
  const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
        {formatTimeRemaining(remaining)}
      </span>
    </div>
  );
}

function SettlementCard({ settlement }: { settlement: SettlementResult }) {
  const [releaseTooltip, setReleaseTooltip] = useState<string | null>(null);

  const settledDate = new Date(settlement.settledAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const transferFeePercent = settlement.equityToken.royaltyBps
    ? (settlement.equityToken.royaltyBps / 100).toFixed(1)
    : "0";

  return (
    <div className="border border-foreground/10 p-5 hover:border-foreground/20 transition-all">
      {/* Card header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-semibold text-lg">{settlement.companyName}</span>
            <span className="text-xs bg-foreground/5 border border-foreground/20 px-2 py-0.5 font-mono">
              {fmt(settlement.consensusValuationM * 1_000_000)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Settled {settledDate}
          </p>
        </div>
        <Link
          href={`/market/${settlement.marketId}`}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          View market <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Token info grid */}
      <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        <div className="border border-foreground/10 p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">MPT Issuance</p>
          <p className="text-xs font-mono font-bold">{truncate(settlement.equityToken.mptIssuanceId)}</p>
        </div>
        <div className="border border-foreground/10 p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Total shares</p>
          <p className="text-xs font-mono font-bold">{settlement.equityToken.totalShares}</p>
        </div>
        <div className="border border-foreground/10 p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Transfer fee</p>
          <p className="text-xs font-mono font-bold">{transferFeePercent}%</p>
        </div>
        <div className="border border-foreground/10 p-2.5">
          <p className="text-xs text-muted-foreground mb-0.5">Valuation cap (XRP)</p>
          <p className="text-xs font-mono font-bold">{settlement.valuationCapXRP ?? "N/A"}</p>
        </div>
      </div>

      {/* Explorer links */}
      {settlement.explorerLinks.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {settlement.explorerLinks.map((link, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs border border-foreground/15 px-2.5 py-1 hover:bg-foreground/5 transition-all font-mono text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3 h-3" />
              TX {i + 1}
            </a>
          ))}
        </div>
      )}

      {/* Escrow table */}
      {settlement.escrows.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Vesting escrows</h3>
          <div className="border border-foreground/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-foreground/10 bg-foreground/[0.02]">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">User</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Shares</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">XRPL Address</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Vesting</th>
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Expires</th>
                    <th className="text-right font-medium text-muted-foreground px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.escrows.map((escrow, idx) => {
                    const now = Date.now();
                    const isUnlocked = escrow.escrow.finishAfter != null
                      ? now >= rippleToDate(escrow.escrow.finishAfter).getTime()
                      : false;
                    const expiresDate = escrow.escrow.cancelAfter != null
                      ? rippleToDate(escrow.escrow.cancelAfter).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "N/A";

                    return (
                      <tr
                        key={idx}
                        className="border-b border-foreground/5 last:border-0 hover:bg-foreground/[0.02] transition-colors"
                      >
                        <td className="px-3 py-2 font-mono">{truncate(escrow.userId)}</td>
                        <td className="px-3 py-2 font-mono font-bold">{escrow.sharesAllocated}</td>
                        <td className="px-3 py-2 font-mono text-muted-foreground">{truncate(escrow.xrplAddress)}</td>
                        <td className="px-3 py-2">
                          <VestingProgress
                            finishAfter={escrow.escrow.finishAfter}
                            cancelAfter={escrow.escrow.cancelAfter}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{expiresDate}</td>
                        <td className="px-3 py-2 text-right relative">
                          <button
                            disabled={!isUnlocked}
                            onClick={() => setReleaseTooltip(releaseTooltip === escrow.userId ? null : escrow.userId)}
                            className={`px-2 py-1 border text-xs font-mono transition-all ${
                              isUnlocked
                                ? "border-green-300 text-green-700 hover:bg-green-50"
                                : "border-foreground/10 text-muted-foreground/50 cursor-not-allowed"
                            }`}
                            title={isUnlocked ? "Requires agent authorization" : "Escrow not yet unlocked"}
                          >
                            Release
                          </button>
                          {releaseTooltip === escrow.userId && (
                            <div className="absolute right-0 top-full mt-1 z-10 bg-background border border-foreground/20 shadow-lg px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <Info className="w-3 h-3" />
                                Requires agent authorization (AGENT_API_SECRET)
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* RLUSD fee */}
      {settlement.rlusdFeeHash && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-foreground/[0.02] border border-foreground/10 p-3 mb-3">
          <Coins className="w-3.5 h-3.5 shrink-0" />
          <span>RLUSD platform fee</span>
          <a
            href={`https://testnet.xrpl.org/transactions/${settlement.rlusdFeeHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-foreground transition-colors flex items-center gap-1"
          >
            {truncate(settlement.rlusdFeeHash)} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* SAFE badge */}
      {settlement.safe && (
        <div className="flex items-center gap-2 text-xs bg-green-50/50 border border-green-200 p-3">
          <Shield className="w-3.5 h-3.5 text-green-600 shrink-0" />
          <span className="text-green-700 font-medium">SAFE on-chain</span>
          <a
            href={settlement.safe.baseSepoliaExplorerUrl ?? `https://sepolia.basescan.org/address/${settlement.safe.contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-green-600 hover:text-green-800 transition-colors flex items-center gap-1"
          >
            {truncate(settlement.safe.contractAddress)} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

export default function EquityPage() {
  const wallet = useWallet();
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<XrplStatus | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Only fetch XRPL data when wallet is connected
  useEffect(() => {
    if (!wallet.connected) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getXrplStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to fetch XRPL status:", err);
          setError("Could not load XRPL data. The backend may be unavailable.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [wallet.connected]);

  const walletEntries = status?.wallets
    ? Object.entries(status.wallets).filter(
        (entry): entry is [string, { address: string; balanceXRP: string; balanceRLUSD: string }] =>
          "address" in entry[1]
      )
    : [];

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
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-display tracking-tight">Equity & Vesting</h1>
              {status && (
                <span className="text-xs font-mono border border-foreground/20 px-2 py-0.5">
                  {status.settlementCount} settlement{status.settlementCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              MPT equity tokens, vesting escrows, and settlement history on XRPL
            </p>
          </div>
          <Coins className="w-8 h-8 text-muted-foreground/30" />
        </div>

        {/* Wallet gate */}
        {!wallet.connected ? (
          <div className={`border border-dashed border-foreground/20 p-16 text-center transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-display mb-2">Connect your wallet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Connect your XRPL wallet to view equity tokens, vesting escrows, and settlement history.
            </p>
            <button
              onClick={wallet.connect}
              className="px-8 py-2.5 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all inline-flex items-center gap-2"
            >
              <Wallet className="w-4 h-4" />
              Connect XRPL wallet
            </button>
          </div>
        ) : loading ? (
          <div className={`border border-dashed border-foreground/20 p-16 text-center transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-4 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading XRPL settlement data...</p>
          </div>
        ) : error ? (
          <div className={`border border-dashed border-foreground/20 p-16 text-center transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-display mb-2">Connection error</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">{error}</p>
          </div>
        ) : !status?.configured ? (
          <div className={`border border-dashed border-foreground/20 p-16 text-center transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-display mb-2">XRPL wallets not configured</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              The backend does not have XRPL wallet seeds configured. Set FOUNDER_SEED and AGENT_SEED
              environment variables to enable equity tracking.
            </p>
          </div>
        ) : (
          <div className={`space-y-6 transition-all duration-500 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}>
            {/* Network status bar */}
            <div className="border border-foreground/10 p-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Network</span>
                  <span className="font-mono font-bold">{status.network}</span>
                </div>
                {walletEntries.map(([name, wallet]) => (
                  <div key={name} className="flex items-center gap-2">
                    <span className="text-muted-foreground capitalize">{name}</span>
                    <span className="font-mono">{truncate(wallet.address)}</span>
                    <span className="font-mono text-muted-foreground">
                      {wallet.balanceXRP} XRP
                    </span>
                    {wallet.balanceRLUSD !== "0" && wallet.balanceRLUSD !== "N/A" && (
                      <span className="font-mono text-muted-foreground">
                        {wallet.balanceRLUSD} RLUSD
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Settlement cards */}
            {status.settlements.length > 0 ? (
              <section>
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                  Settlements
                </h2>
                <div className="space-y-4">
                  {status.settlements.map((settlement) => (
                    <SettlementCard key={settlement.marketId} settlement={settlement} />
                  ))}
                </div>
              </section>
            ) : (
              <div className="border border-dashed border-foreground/20 p-16 text-center">
                <Coins className="w-10 h-10 text-muted-foreground/50 mx-auto mb-4" />
                <h2 className="text-xl font-display mb-2">No settlements yet</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Analyze a repo, open a market, and settle to see equity tokens here.
                </p>
                <Link
                  href="/dashboard"
                  className="px-8 py-2.5 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all"
                >
                  Go to dashboard
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <WalletModal
        open={wallet.showModal}
        onClose={wallet.closeModal}
        onConfirm={wallet.confirm}
      />
    </div>
  );
}
