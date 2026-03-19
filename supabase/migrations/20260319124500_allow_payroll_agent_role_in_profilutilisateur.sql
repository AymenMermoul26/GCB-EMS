ALTER TABLE public."ProfilUtilisateur"
  DROP CONSTRAINT IF EXISTS ck_profilutilisateur_role;

ALTER TABLE public."ProfilUtilisateur"
  ADD CONSTRAINT ck_profilutilisateur_role
  CHECK (role IN ('ADMIN_RH', 'EMPLOYE', 'PAYROLL_AGENT'));
