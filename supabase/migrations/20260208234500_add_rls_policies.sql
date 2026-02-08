-- =====================================================================
-- Production RLS for EMS schema (Supabase/PostgreSQL)
-- Tables:
--   "Departement", "Employe", "ProfilUtilisateur", "TokenQR",
--   "DemandeModification", employee_visibility, audit_log, notifications
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Helper functions for role/context resolution from ProfilUtilisateur
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_employe_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pu.employe_id
  FROM public."ProfilUtilisateur" pu
  WHERE pu.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_rh()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."ProfilUtilisateur" pu
    WHERE pu.user_id = auth.uid()
      AND pu.role = 'ADMIN_RH'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_employe_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public."ProfilUtilisateur" pu
    WHERE pu.user_id = auth.uid()
      AND pu.role = 'EMPLOYE'
  );
$$;

REVOKE ALL ON FUNCTION public.current_employe_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_rh() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_employe_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_employe_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_rh() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_employe_user() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) Enable RLS on all application tables
-- ---------------------------------------------------------------------

ALTER TABLE public."Departement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Employe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProfilUtilisateur" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TokenQR" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DemandeModification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_visibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3) Remove old policies (idempotent migration)
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS admin_all_departement ON public."Departement";
DROP POLICY IF EXISTS admin_all_employe ON public."Employe";
DROP POLICY IF EXISTS admin_all_profilutilisateur ON public."ProfilUtilisateur";
DROP POLICY IF EXISTS admin_all_tokenqr ON public."TokenQR";
DROP POLICY IF EXISTS admin_all_demandemodification ON public."DemandeModification";
DROP POLICY IF EXISTS admin_all_employee_visibility ON public.employee_visibility;
DROP POLICY IF EXISTS admin_all_audit_log ON public.audit_log;
DROP POLICY IF EXISTS admin_all_notifications ON public.notifications;

DROP POLICY IF EXISTS employee_select_departement ON public."Departement";
DROP POLICY IF EXISTS employee_select_own_employe ON public."Employe";
DROP POLICY IF EXISTS employee_select_own_profile ON public."ProfilUtilisateur";
DROP POLICY IF EXISTS employee_update_own_profile ON public."ProfilUtilisateur";
DROP POLICY IF EXISTS employee_select_own_tokenqr ON public."TokenQR";
DROP POLICY IF EXISTS employee_insert_own_demande ON public."DemandeModification";
DROP POLICY IF EXISTS employee_select_own_demande ON public."DemandeModification";
DROP POLICY IF EXISTS employee_select_own_notifications ON public.notifications;
DROP POLICY IF EXISTS employee_update_own_notifications ON public.notifications;
DROP POLICY IF EXISTS employee_select_own_visibility ON public.employee_visibility;

-- ---------------------------------------------------------------------
-- 4) Admin RH policies: full CRUD on all tables
-- ---------------------------------------------------------------------

CREATE POLICY admin_all_departement
ON public."Departement"
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

CREATE POLICY admin_all_employe
ON public."Employe"
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

CREATE POLICY admin_all_profilutilisateur
ON public."ProfilUtilisateur"
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

CREATE POLICY admin_all_tokenqr
ON public."TokenQR"
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

CREATE POLICY admin_all_demandemodification
ON public."DemandeModification"
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

CREATE POLICY admin_all_employee_visibility
ON public.employee_visibility
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

CREATE POLICY admin_all_audit_log
ON public.audit_log
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

CREATE POLICY admin_all_notifications
ON public.notifications
FOR ALL
TO authenticated
USING (public.is_admin_rh())
WITH CHECK (public.is_admin_rh());

-- ---------------------------------------------------------------------
-- 5) Employee policies (least privilege)
-- ---------------------------------------------------------------------

-- Departement: read-only for employees (for display/lookup)
CREATE POLICY employee_select_departement
ON public."Departement"
FOR SELECT
TO authenticated
USING (public.is_employe_user());

-- Employe: employee can read only own row
CREATE POLICY employee_select_own_employe
ON public."Employe"
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND id = public.current_employe_id()
);

-- ProfilUtilisateur: employee reads/updates only own profile, cannot escalate role
CREATE POLICY employee_select_own_profile
ON public."ProfilUtilisateur"
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND user_id = auth.uid()
);

CREATE POLICY employee_update_own_profile
ON public."ProfilUtilisateur"
FOR UPDATE
TO authenticated
USING (
  public.is_employe_user()
  AND user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
  AND employe_id = public.current_employe_id()
  AND role = 'EMPLOYE'
);

-- TokenQR: employee can read own token history
CREATE POLICY employee_select_own_tokenqr
ON public."TokenQR"
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
);

-- DemandeModification:
-- - employee can read own requests
-- - employee can insert only own request and only with EN_ATTENTE
CREATE POLICY employee_select_own_demande
ON public."DemandeModification"
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
);

CREATE POLICY employee_insert_own_demande
ON public."DemandeModification"
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
  AND statut_demande = 'EN_ATTENTE'::public.statut_demande_enum
  AND (demandeur_user_id IS NULL OR demandeur_user_id = auth.uid())
);

-- notifications: employee can read/update own notifications
CREATE POLICY employee_select_own_notifications
ON public.notifications
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND user_id = auth.uid()
);

CREATE POLICY employee_update_own_notifications
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  public.is_employe_user()
  AND user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- employee_visibility: employee can read own visibility settings only
CREATE POLICY employee_select_own_visibility
ON public.employee_visibility
FOR SELECT
TO authenticated
USING (
  public.is_employe_user()
  AND employe_id = public.current_employe_id()
);

-- ---------------------------------------------------------------------
-- 6) Hardening trigger:
--    Employees can only mark notifications as read (is_read flag).
--    Admin RH keeps full update capability.
-- ---------------------------------------------------------------------

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
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Employees may only mark notifications as read.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_notifications_employee_update ON public.notifications;
CREATE TRIGGER trg_guard_notifications_employee_update
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.guard_notifications_employee_update();

REVOKE ALL ON FUNCTION public.guard_notifications_employee_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_notifications_employee_update() TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7) Role-level privilege guardrails
--    - anon: no direct table access
--    - authenticated: table privileges allowed, RLS enforces row-level rules
-- ---------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public."Departement" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."Employe" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."ProfilUtilisateur" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."TokenQR" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public."DemandeModification" FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.employee_visibility FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.audit_log FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.notifications FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Departement" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Employe" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ProfilUtilisateur" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."TokenQR" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."DemandeModification" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.employee_visibility TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO authenticated;

-- =====================================================================
-- End migration
-- =====================================================================
