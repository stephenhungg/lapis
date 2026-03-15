"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient, type Profile } from "@/lib/supabase";

interface AuthState {
  /** user's XRPL wallet address (primary identity) */
  address: string | null;
  /** profile from supabase (display name, email, etc) */
  profile: Profile | null;
  /** whether we're loading initial state */
  loading: boolean;
  /** whether wallet is connected */
  connected: boolean;
  /** connect wallet (manual address for now, Xumm later) */
  connect: (address: string) => Promise<void>;
  /** disconnect wallet */
  disconnect: () => void;
  /** update profile fields */
  updateProfile: (updates: Partial<Pick<Profile, "display_name" | "xrpl_address" | "role">>) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const WALLET_KEY = "lapis_xrpl_wallet";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchProfile = useCallback(async (addr: string) => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("xrpl_address", addr)
        .single();
      if (data) setProfile(data as Profile);
    } catch {
      // no profile yet, that's fine
    }
  }, [supabase]);

  // load saved wallet on mount
  useEffect(() => {
    const saved = localStorage.getItem(WALLET_KEY);
    if (saved) {
      setAddress(saved);
      fetchProfile(saved);
    }
    setLoading(false);
  }, [fetchProfile]);

  const connect = async (addr: string) => {
    // validate XRPL address format
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(addr)) {
      throw new Error("Invalid XRPL address");
    }

    localStorage.setItem(WALLET_KEY, addr);
    // also store in legacy key for backward compat
    localStorage.setItem("lapis_xrpl_address", addr);
    setAddress(addr);

    // upsert profile in supabase
    try {
      const { data: existing } = await supabase
        .from("profiles")
        .select("*")
        .eq("xrpl_address", addr)
        .single();

      if (existing) {
        setProfile(existing as Profile);
      } else {
        // create a new profile for this wallet
        const { data: newProfile } = await supabase
          .from("profiles")
          .insert({ id: crypto.randomUUID(), xrpl_address: addr })
          .select()
          .single();
        if (newProfile) setProfile(newProfile as Profile);
      }
    } catch {
      // supabase may not be configured, continue without profile
    }
  };

  const disconnect = () => {
    localStorage.removeItem(WALLET_KEY);
    localStorage.removeItem("lapis_xrpl_address");
    setAddress(null);
    setProfile(null);
  };

  const updateProfile = async (
    updates: Partial<Pick<Profile, "display_name" | "xrpl_address" | "role">>
  ) => {
    if (!address) throw new Error("Not connected");
    try {
      await supabase
        .from("profiles")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("xrpl_address", address);
      await fetchProfile(address);
    } catch {
      // supabase may not be configured
    }
  };

  return (
    <AuthContext.Provider
      value={{
        address,
        profile,
        loading,
        connected: !!address,
        connect,
        disconnect,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
