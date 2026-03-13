CREATE OR REPLACE FUNCTION public.guard_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin_rh() THEN
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
