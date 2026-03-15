"use client";

import { useState, useCallback } from "react";
import { X, Wallet, Loader2, ExternalLink, ChevronLeft } from "lucide-react";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (address: string) => void;
}

type WalletOption = "xumm" | "gem" | "crossmark" | "manual" | null;

const FAUCET_URL = "https://faucet.altnet.rippletest.net/accounts";

export function WalletModal({ open, onClose, onConfirm }: WalletModalProps) {
  const [selected, setSelected] = useState<WalletOption>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const reset = useCallback(() => {
    setSelected(null);
    setInput("");
    setError("");
    setLoading(false);
  }, []);

  if (!open) return null;

  const handleClose = () => {
    reset();
    onClose();
  };

  // --- Xumm connect ---
  async function connectXumm() {
    setLoading(true);
    setError("");
    try {
      const { Xumm } = await import("xumm");
      const xumm = new Xumm(process.env.NEXT_PUBLIC_XUMM_API_KEY || "");
      await xumm.authorize();
      const account = await xumm.user.account;
      if (!account) throw new Error("No account returned from Xumm");
      onConfirm(account);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xumm connection failed");
    } finally {
      setLoading(false);
    }
  }

  // --- GemWallet connect ---
  async function connectGem() {
    setLoading(true);
    setError("");
    try {
      const { isInstalled, getAddress } = await import("@gemwallet/api");
      const installed = await isInstalled();
      if (!installed?.result?.isInstalled) {
        setError("GemWallet extension not detected. Install it from gemwallet.app");
        setLoading(false);
        return;
      }
      const response = await getAddress();
      const address = response?.result?.address;
      if (!address) throw new Error("No address returned from GemWallet");
      onConfirm(address);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GemWallet connection failed");
    } finally {
      setLoading(false);
    }
  }

  // --- Crossmark connect ---
  async function connectCrossmark() {
    setLoading(true);
    setError("");
    try {
      const sdk = (await import("@crossmarkio/sdk")).default;
      const { response } = await sdk.methods.signInAndWait();
      const address = response?.data?.address;
      if (!address) throw new Error("No address returned from Crossmark");
      onConfirm(address);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Crossmark connection failed");
    } finally {
      setLoading(false);
    }
  }

  // --- Manual paste ---
  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const addr = input.trim();
    if (!addr.startsWith("r") || addr.length < 25 || addr.length > 35) {
      setError("Enter a valid XRPL address (starts with r, 25-35 characters)");
      return;
    }
    setError("");
    onConfirm(addr);
    reset();
  }

  // --- Generate testnet wallet ---
  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(FAUCET_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Faucet error (${res.status})`);
      const data = await res.json();
      const addr = data.account?.classicAddress || data.account?.address;
      if (!addr) throw new Error("No address in faucet response");
      onConfirm(addr);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate wallet");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-background border border-foreground/10 shadow-2xl w-full max-w-md mx-4 p-6">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* header */}
        <div className="flex items-center gap-2 mb-2">
          {selected && (
            <button onClick={reset} className="text-muted-foreground hover:text-foreground transition mr-1">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <Wallet className="w-5 h-5" />
          <h2 className="text-lg font-display">Connect wallet</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {selected ? "Connecting..." : "Choose how to connect your XRPL wallet."}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 mb-4">
            {error}
          </div>
        )}

        {/* wallet selection */}
        {!selected && (
          <div className="space-y-2">
            <button
              onClick={() => { setSelected("xumm"); connectXumm(); }}
              className="w-full flex items-center gap-3 p-4 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all text-left group"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
                X
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Xumm (Xaman)</p>
                <p className="text-xs text-muted-foreground">Scan QR code with mobile app</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
            </button>

            <button
              onClick={() => { setSelected("gem"); connectGem(); }}
              className="w-full flex items-center gap-3 p-4 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all text-left group"
            >
              <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
                G
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">GemWallet</p>
                <p className="text-xs text-muted-foreground">Browser extension</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
            </button>

            <button
              onClick={() => { setSelected("crossmark"); connectCrossmark(); }}
              className="w-full flex items-center gap-3 p-4 border border-foreground/10 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all text-left group"
            >
              <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0">
                C
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Crossmark</p>
                <p className="text-xs text-muted-foreground">Browser extension</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
            </button>

            <div className="relative flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-foreground/10" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-foreground/10" />
            </div>

            <button
              onClick={() => setSelected("manual")}
              className="w-full flex items-center gap-3 p-4 border border-dashed border-foreground/15 hover:border-foreground/30 hover:bg-foreground/[0.02] transition-all text-left"
            >
              <div className="w-10 h-10 bg-foreground/10 rounded-lg flex items-center justify-center text-foreground/60 font-mono text-xs shrink-0">
                r...
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Paste address</p>
                <p className="text-xs text-muted-foreground">Enter XRPL address manually</p>
              </div>
            </button>
          </div>
        )}

        {/* loading state for wallet SDKs */}
        {selected && selected !== "manual" && loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {selected === "xumm" ? "Waiting for Xumm approval..." :
               selected === "gem" ? "Connecting to GemWallet..." :
               "Connecting to Crossmark..."}
            </p>
          </div>
        )}

        {/* manual paste form */}
        {selected === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <input
                className="w-full border border-foreground/20 bg-background px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-foreground/50 transition placeholder-muted-foreground"
                placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(""); }}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!input.trim()}
              className="w-full py-3 bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Connect
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-foreground/10" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-foreground/10" />
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 border border-foreground/20 text-sm font-semibold hover:bg-foreground/5 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating wallet...
                </>
              ) : (
                "Generate free testnet wallet"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
