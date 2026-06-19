-- Enforce a single profile per wallet address at the DATA layer.
--
-- Root cause this guards against: wallet sign-in keyed identity on a SYNTHETIC
-- email (`<address>@wallet.<domain>.local`). When the domain changed between
-- deploys (sablon.local -> lanark.local), `createUser({ email })` no longer
-- collided with the existing user, so a SECOND auth user was minted for the
-- same wallet. The seller's products stayed under the old user id while the
-- live session resolved to the new, empty one — the products looked "lost".
--
-- The application layer now resolves identity by address (smart_wallets, then
-- profiles.primary_address) before ever creating a user. This index is the
-- backstop so the database refuses a duplicate even if that logic regresses.
--
-- Idempotent. Requires existing duplicates to be consolidated first (the
-- one known duplicate has already been merged into the active user).

CREATE UNIQUE INDEX IF NOT EXISTS profiles_primary_address_uidx
  ON public.profiles (lower(primary_address))
  WHERE primary_address IS NOT NULL;
