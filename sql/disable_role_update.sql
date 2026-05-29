-- Migration: Prevent role from being changed after first set

-- Add a role_locked boolean to profiles and default to true for existing rows
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS role_locked boolean DEFAULT true;

-- If you prefer to only lock role when it is first set, you can run an update
-- to set role_locked = true only for rows that already have a role.
-- UPDATE public.profiles SET role_locked = true WHERE role IS NOT NULL;

-- Trigger function to prevent role updates when locked
CREATE OR REPLACE FUNCTION public.profiles_prevent_role_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.role IS DISTINCT FROM NEW.role) AND OLD.role_locked THEN
      RAISE EXCEPTION 'Role is locked and cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_prevent_role_update ON public.profiles;
CREATE TRIGGER trg_profiles_prevent_role_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_prevent_role_update();

-- NOTE: This migration must be run with a service role (Supabase migration) and
-- applied carefully. The application's sign-in flow will set the role only on
-- first sign-in; subsequent attempts to change the role will fail with 500
-- unless you explicitly unset role_locked.
