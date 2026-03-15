import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  xrpl_address: string | null;
  role: "investor" | "founder" | "admin";
  created_at: string;
  updated_at: string;
};
