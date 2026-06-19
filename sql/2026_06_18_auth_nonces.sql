-- Single-use sign-in nonces. Issued by /api/auth/nonce and burned by
-- /api/auth/wallet to stop wallet-signature replay (SEC-02).
-- Only the service role touches this table; no RLS policies are granted, so
-- anon/authenticated roles cannot read or write it.

create table if not exists public.auth_nonces (
  nonce text primary key,
  address text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists auth_nonces_expires_idx on public.auth_nonces (expires_at);

alter table public.auth_nonces enable row level security;

-- Optional housekeeping helper: delete expired/used nonces. Call from a cron.
create or replace function public.purge_auth_nonces() returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_nonces
  where expires_at < now() - interval '1 hour';
$$;
