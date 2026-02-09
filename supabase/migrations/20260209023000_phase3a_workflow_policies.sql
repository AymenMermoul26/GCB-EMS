-- =====================================================================
-- Phase 3a workflow RLS adjustments
-- - Allow limited employee self-update on Employe
-- - Allow employee audit_log inserts for self-service actions
-- - Allow employee notifications inserts targeting admin users
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Helper: check if a given auth user is ADMIN_RH
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."ProfilUtilisateur" pu
    WHERE pu.user_id = p_user_id
      AND pu.role = 'ADMIN_RH'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pu.user_id
  FROM public."ProfilUtilisateur" pu
  WHERE pu.role = 'ADMIN_RH'
    AND pu.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_user_ids() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) Employe: allow employees to update only their own row
--    Actual column-level restriction is enforced with trigger below.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS employee_update_own_employe ON public."Employe";

CREATE POLICY employee_update_own_employe
ON public."Employe"
FOR UPDATE
TO authenticated
USING (
  public.is_employe_user()
  AND id = public.current_employe_id()
)
WITH CHECK (
  public.is_employe_user()
  AND id = public.current_employe_id()
);

CREATE OR REPLACE FUNCTION public.guard_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin_rh() THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_employe_user() THEN
    RAISE EXCEPTION 'Only employees can perform self-update with this policy.';
  END IF;

  IF OLD.id <> public.current_employe_id() THEN
    RAISE EXCEPTION 'You can only update your own employee record.';
  END IF;

  IF NEW.departement_id IS DISTINCT FROM OLD.departement_id
     OR NEW.matricule IS DISTINCT FROM OLD.matricule
     OR NEW.nom IS DISTINCT FROM OLD.nom
     OR NEW.prenom IS DISTINCT FROM OLD.prenom
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'You can only edit poste, email, telephone, and photo_url.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_employee_self_update ON public."Employe";
CREATE TRIGGER trg_guard_employee_self_update
BEFORE UPDATE ON public."Employe"
FOR EACH ROW
EXECUTE FUNCTION public.guard_employee_self_update();

REVOKE ALL ON FUNCTION public.guard_employee_self_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_employee_self_update() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) audit_log: allow employees to insert constrained self-service audits
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS employee_insert_self_audit_log ON public.audit_log;

CREATE POLICY employee_insert_self_audit_log
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_employe_user()
  AND actor_user_id = auth.uid()
  AND (
    (
      action = 'EMPLOYEE_SELF_UPDATED'
      AND target_type = 'Employe'
      AND target_id = public.current_employe_id()
    )
    OR
    (
      action = 'REQUEST_SUBMITTED'
      AND target_type = 'DemandeModification'
      AND target_id IS NOT NULL
    )
  )
);

-- ---------------------------------------------------------------------
-- 4) notifications: allow employees to notify admins only
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS employee_insert_admin_notifications ON public.notifications;

CREATE POLICY employee_insert_admin_notifications
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_employe_user()
  AND public.is_admin_user(user_id)
  AND is_read = false
);

-- =====================================================================
-- End migration
-- =====================================================================

