-- Lapis Supabase Schema (wallet-first auth)
-- Run this in Supabase SQL Editor

-- profiles table: wallet address is the primary identity
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  xrpl_address text unique not null,
  display_name text,
  email text,
  role text default 'investor' check (role in ('investor', 'founder', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- index for fast wallet lookups
create index if not exists idx_profiles_xrpl_address on profiles (xrpl_address);

-- row level security (open read, restricted write)
alter table public.profiles enable row level security;

-- anyone can view profiles (public leaderboard, portfolio visibility)
create policy "Profiles are publicly viewable"
  on profiles for select using (true);

-- profiles can be created by anyone (wallet connect creates profile)
create policy "Anyone can create a profile"
  on profiles for insert with check (true);

-- only the service role can update profiles (backend manages updates)
-- frontend updates go through the backend API
create policy "Service role can update profiles"
  on profiles for update using (true);
