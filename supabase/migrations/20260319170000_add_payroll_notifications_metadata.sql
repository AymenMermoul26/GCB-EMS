ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_scope_created_at
ON public.notifications ((metadata_json->>'scope'), created_at DESC);

CREATE OR REPLACE FUNCTION public.guard_notifications_employee_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_rh() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.link IS DISTINCT FROM OLD.link
     OR NEW.metadata_json IS DISTINCT FROM OLD.metadata_json
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Employees may only mark notifications as read.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_notifications_employee_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_notifications_employee_update() TO authenticated, service_role;
