CREATE OR REPLACE FUNCTION public.is_payroll_agent()
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
      AND pu.role = 'PAYROLL_AGENT'
  );
$$;

REVOKE ALL ON FUNCTION public.is_payroll_agent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_payroll_agent() TO authenticated, service_role;

DROP POLICY IF EXISTS payroll_select_own_profile ON public."ProfilUtilisateur";

CREATE POLICY payroll_select_own_profile
ON public."ProfilUtilisateur"
FOR SELECT
TO authenticated
USING (
  public.is_payroll_agent()
  AND user_id = auth.uid()
);
