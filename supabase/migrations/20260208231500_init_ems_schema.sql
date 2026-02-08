-- =====================================================================
-- EMS Thesis Schema (Supabase/PostgreSQL)
-- Core tables kept exactly as requested:
--   1) Departement
--   2) Employe
--   3) ProfilUtilisateur
--   4) TokenQR
--   5) DemandeModification
-- Support tables added (only):
--   - employee_visibility
--   - audit_log
--   - notifications
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) Extensions
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------
-- 1) ENUM types for statuses
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'statut_token_enum'
  ) THEN
    CREATE TYPE public.statut_token_enum AS ENUM ('ACTIF', 'REVOQUE');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'statut_demande_enum'
  ) THEN
    CREATE TYPE public.statut_demande_enum AS ENUM ('EN_ATTENTE', 'ACCEPTEE', 'REJETEE');
  END IF;
END
$$;

-- ---------------------------------------------------------------------
-- 2) Generic updated_at trigger function
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------
-- 3) Core thesis tables
-- ---------------------------------------------------------------------

-- 3.1 Departement
CREATE TABLE IF NOT EXISTS public."Departement" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  code text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_departement_nom UNIQUE (nom),
  CONSTRAINT uq_departement_code UNIQUE (code)
);

-- 3.2 Employe
CREATE TABLE IF NOT EXISTS public."Employe" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  departement_id uuid NOT NULL,
  matricule text NOT NULL,
  nom text NOT NULL,
  prenom text NOT NULL,
  poste text,
  email text,
  telephone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employe_matricule UNIQUE (matricule),
  CONSTRAINT fk_employe_departement
    FOREIGN KEY (departement_id)
    REFERENCES public."Departement" (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
);

-- 3.3 ProfilUtilisateur
-- 0..1 profile per employee (UNIQUE employe_id)
CREATE TABLE IF NOT EXISTS public."ProfilUtilisateur" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL,
  user_id uuid,
  role text NOT NULL DEFAULT 'EMPLOYE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_profilutilisateur_employe UNIQUE (employe_id),
  CONSTRAINT uq_profilutilisateur_user UNIQUE (user_id),
  CONSTRAINT ck_profilutilisateur_role CHECK (role IN ('ADMIN_RH', 'EMPLOYE')),
  CONSTRAINT fk_profilutilisateur_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_profilutilisateur_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- 3.4 TokenQR
CREATE TABLE IF NOT EXISTS public."TokenQR" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL,
  token text NOT NULL,
  statut_token public.statut_token_enum NOT NULL DEFAULT 'ACTIF',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tokenqr_token UNIQUE (token),
  CONSTRAINT fk_tokenqr_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- 3.5 DemandeModification
CREATE TABLE IF NOT EXISTS public."DemandeModification" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL,
  demandeur_user_id uuid,
  champ_cible text NOT NULL,
  ancienne_valeur text,
  nouvelle_valeur text,
  motif text,
  statut_demande public.statut_demande_enum NOT NULL DEFAULT 'EN_ATTENTE',
  traite_par_user_id uuid,
  traite_at timestamptz,
  commentaire_traitement text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_demandemodification_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_demandemodification_demandeur
    FOREIGN KEY (demandeur_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,
  CONSTRAINT fk_demandemodification_traite_par
    FOREIGN KEY (traite_par_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
-- 4) Support tables (allowed additions only)
-- ---------------------------------------------------------------------

-- 4.1 employee_visibility
CREATE TABLE IF NOT EXISTS public.employee_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id uuid NOT NULL,
  field_key text NOT NULL,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_employee_visibility_employe_field UNIQUE (employe_id, field_key),
  CONSTRAINT fk_employee_visibility_employe
    FOREIGN KEY (employe_id)
    REFERENCES public."Employe" (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- 4.2 audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_audit_log_actor_user
    FOREIGN KEY (actor_user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
);

-- 4.3 notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id)
    REFERENCES auth.users (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
-- 5) Indexing strategy
--    (matricule, nom, prenom, departement, is_active, statuses, etc.)
-- ---------------------------------------------------------------------

-- Employe search/filter indexes
-- uq_employe_matricule already creates a unique index on matricule.
CREATE INDEX IF NOT EXISTS idx_employe_nom ON public."Employe" (lower(nom));
CREATE INDEX IF NOT EXISTS idx_employe_prenom ON public."Employe" (lower(prenom));
CREATE INDEX IF NOT EXISTS idx_employe_departement_id ON public."Employe" (departement_id);
CREATE INDEX IF NOT EXISTS idx_employe_is_active ON public."Employe" (is_active);
CREATE INDEX IF NOT EXISTS idx_employe_nom_prenom ON public."Employe" (lower(nom), lower(prenom));

-- Departement lookup
CREATE INDEX IF NOT EXISTS idx_departement_nom ON public."Departement" (lower(nom));

-- Token and status indexes
CREATE INDEX IF NOT EXISTS idx_tokenqr_employe_id ON public."TokenQR" (employe_id);
CREATE INDEX IF NOT EXISTS idx_tokenqr_statut_token ON public."TokenQR" (statut_token);
CREATE INDEX IF NOT EXISTS idx_tokenqr_created_at ON public."TokenQR" (created_at DESC);

-- One active token per employee (critical thesis rule)
CREATE UNIQUE INDEX IF NOT EXISTS uq_tokenqr_one_active_per_employe
  ON public."TokenQR" (employe_id)
  WHERE statut_token = 'ACTIF'::public.statut_token_enum;

-- DemandeModification status/workflow
CREATE INDEX IF NOT EXISTS idx_demandemodification_employe_id
  ON public."DemandeModification" (employe_id);
CREATE INDEX IF NOT EXISTS idx_demandemodification_statut
  ON public."DemandeModification" (statut_demande);
CREATE INDEX IF NOT EXISTS idx_demandemodification_created_at
  ON public."DemandeModification" (created_at DESC);

-- Visibility, audit, notifications
CREATE INDEX IF NOT EXISTS idx_employee_visibility_employe_id
  ON public.employee_visibility (employe_id);
CREATE INDEX IF NOT EXISTS idx_employee_visibility_is_public
  ON public.employee_visibility (is_public);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_user_id
  ON public.audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target
  ON public.audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON public.notifications (created_at DESC);

-- ---------------------------------------------------------------------
-- 6) updated_at triggers on ALL tables
-- ---------------------------------------------------------------------

CREATE TRIGGER trg_departement_set_updated_at
BEFORE UPDATE ON public."Departement"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_employe_set_updated_at
BEFORE UPDATE ON public."Employe"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profilutilisateur_set_updated_at
BEFORE UPDATE ON public."ProfilUtilisateur"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tokenqr_set_updated_at
BEFORE UPDATE ON public."TokenQR"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_demandemodification_set_updated_at
BEFORE UPDATE ON public."DemandeModification"
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_employee_visibility_set_updated_at
BEFORE UPDATE ON public.employee_visibility
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_log_set_updated_at
BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_notifications_set_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- 7) Public profile access via QR token
--    Best practice chosen: SQL function returning JSON
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employe public."Employe"%ROWTYPE;
  v_departement_nom text;
  v_payload jsonb;
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT e.*
    INTO v_employe
  FROM public."TokenQR" t
  INNER JOIN public."Employe" e ON e.id = t.employe_id
  WHERE t.token = p_token
    AND t.statut_token = 'ACTIF'::public.statut_token_enum
    AND e.is_active = true
    AND (t.expires_at IS NULL OR t.expires_at > now())
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT d.nom
    INTO v_departement_nom
  FROM public."Departement" d
  WHERE d.id = v_employe.departement_id;

  -- Candidate fields available for publication.
  -- Only fields marked public in employee_visibility are returned.
  v_payload := jsonb_build_object(
    'id', v_employe.id,
    'matricule', v_employe.matricule,
    'nom', v_employe.nom,
    'prenom', v_employe.prenom,
    'poste', v_employe.poste,
    'email', v_employe.email,
    'telephone', v_employe.telephone,
    'departement', v_departement_nom
  );

  SELECT COALESCE(jsonb_object_agg(kv.key, kv.value), '{}'::jsonb)
    INTO v_result
  FROM jsonb_each(v_payload) AS kv(key, value)
  INNER JOIN public.employee_visibility ev
    ON ev.employe_id = v_employe.id
   AND ev.field_key = kv.key
   AND ev.is_public = true;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_token(text) TO anon, authenticated, service_role;

-- =====================================================================
-- End of migration
-- =====================================================================

