-- Add mobile phone (E.164) + ISO country to profiles.
-- Used for order-confirmation SMS and abandoned-cart recovery links.
-- profiles is altered idempotently (the table was created outside the repo).

alter table public.profiles
  add column if not exists phone text,
  add column if not exists phone_country text default 'CO';

comment on column public.profiles.phone is 'E.164 mobile, e.g. +573001234567 (off-chain PII, minimized).';
comment on column public.profiles.phone_country is 'ISO 3166-1 alpha-2 dialing country, default CO (+57).';

-- Optional sanity guard: when present, phone must look like E.164.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_phone_e164_chk'
  ) then
    alter table public.profiles
      add constraint profiles_phone_e164_chk
      check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$');
  end if;
end $$;
