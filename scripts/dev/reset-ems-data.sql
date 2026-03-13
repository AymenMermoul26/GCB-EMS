-- Dev/demo reset only.
-- Clears application row data while preserving schema, RLS, triggers, indexes, enums, and functions.
-- Does NOT delete auth.users. Handle auth cleanup through the admin bootstrap script.

BEGIN;

TRUNCATE TABLE
  public.notifications,
  public.audit_log,
  public.employee_visibility,
  public."DemandeModification",
  public."TokenQR",
  public."ProfilUtilisateur",
  public."Employe",
  public."Departement"
RESTART IDENTITY CASCADE;

SELECT public.reset_employe_matricule_sequence(1, false);

COMMIT;
