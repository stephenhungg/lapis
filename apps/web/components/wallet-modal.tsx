"use client";

import { useState } from "react";
import { X, Wallet, Loader2 } from "lucide-react";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (address: string) => void;
}

const FAUCET_URL = "https://faucet.altnet.rippletest.net/accounts";

export function WalletModal({ open, onClose, onConfirm }: WalletModalProps) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const addr = input.trim();
    if (!addr.startsWith("r") || addr.length < 25 || addr.length > 35) {
      setError("Enter a valid XRPL address (starts with r, 25-35 characters)");
      return;
    }
    setError("");
    onConfirm(addr);
    setInput("");
  }

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
      // auto-fill and connect
      setInput(addr);
      onConfirm(addr);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate wallet");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative bg-background border border-foreground/10 shadow-2xl w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5" />
          <h2 className="text-lg font-display">Connect XRPL wallet</h2>
        </div>

        <p className="text-sm text-muted-foreground mb-5">
          Paste your XRPL testnet address, or generate a free one instantly.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              className="w-full border border-foreground/20 bg-background px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-foreground/50 transition placeholder-muted-foreground"
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-500 mt-1.5">{error}</p>
            )}
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
      </div>
    </div>
  );
}
