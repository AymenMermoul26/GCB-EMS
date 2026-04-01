ALTER TABLE public."DemandeModification"
  DROP CONSTRAINT IF EXISTS demandemodification_champ_cible_check;

ALTER TABLE public."DemandeModification"
  ADD CONSTRAINT demandemodification_champ_cible_check
  CHECK (
    champ_cible = ANY (
      ARRAY[
        'poste',
        'email',
        'telephone',
        'photo_url',
        'nom',
        'prenom',
        'regional_branch',
        'sexe',
        'date_naissance',
        'lieu_naissance',
        'nationalite',
        'situation_familiale',
        'nombre_enfants',
        'adresse',
        'diplome',
        'specialite',
        'universite',
        'historique_postes'
      ]::text[]
    )
  );

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
         format('Employee request for %s.', initcap(replace(NEW.champ_cible, '_', ' '))),
         '/admin/requests',
         false
  FROM public."ProfilUtilisateur" pu
  WHERE pu.role = 'ADMIN_RH'
    AND pu.user_id IS NOT NULL;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admins_on_request_insert() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_admins_on_request_insert() TO authenticated, service_role;