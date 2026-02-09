-- =====================================================================
-- Notifications isolation hardening
-- - Enforce per-user notification reads/updates for all authenticated users
-- - Restrict notification inserts to admins only
-- - Move employee->admin notification fanout to DB trigger on DemandeModification
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Replace notifications policies with strict per-user isolation
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS admin_all_notifications ON public.notifications;
DROP POLICY IF EXISTS employee_select_own_notifications ON public.notifications;
DROP POLICY IF EXISTS employee_update_own_notifications ON public.notifications;
DROP POLICY IF EXISTS employee_insert_admin_notifications ON public.notifications;
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_admin_only ON public.notifications;

CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY notifications_update_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_insert_admin_only
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_rh());

-- ---------------------------------------------------------------------
-- 2) Auto-notify all admins when a modification request is submitted
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admins_on_request_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.statut_demande <> 'EN_ATTENTE'::public.statut_demande_enum THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, body, link, is_read)
  SELECT pu.user_id,
         'New modification request',
         format('Employee request for %s.', NEW.champ_cible),
         '/admin/requests',
         false
  FROM public."ProfilUtilisateur" pu
  WHERE pu.role = 'ADMIN_RH'
    AND pu.user_id IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_request_insert ON public."DemandeModification";
CREATE TRIGGER trg_notify_admins_on_request_insert
AFTER INSERT ON public."DemandeModification"
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_request_insert();

REVOKE ALL ON FUNCTION public.notify_admins_on_request_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins_on_request_insert() TO authenticated, service_role;

-- =====================================================================
-- End migration
-- =====================================================================
