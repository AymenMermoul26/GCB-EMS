-- =====================================================================
-- Dev/demo seed data for EMS
-- Safe to run multiple times.
-- Inserts realistic departments without creating duplicates.
-- =====================================================================

INSERT INTO public."Departement" (nom, code, description)
VALUES
  ('Direction des Ressources Humaines', 'DRH', 'Corporate HR leadership and governance.'),
  ('Service Planification et Contrôle des Effectifs', 'SPCE', 'Headcount planning, workforce controls, and staffing analysis.'),
  ('Département Gestion et Contrôle des Ressources Humaines', 'DGCRH', 'Personnel administration and HR control operations.'),
  ('Département Relations de Travail', 'DRT', 'Labor relations, social dialogue, and compliance support.'),
  ('Service Réglementation de Travail', 'SRT', 'Work regulation, policy interpretation, and internal labor procedures.'),
  ('Service Médiation et Traitement des Requêtes', 'SMTR', 'Mediation, grievance handling, and employee request treatment.'),
  ('Département Développement des Ressources Humaines', 'DDRH', 'HR development strategy and organizational capability programs.'),
  ('Service Organisation', 'SORG', 'Organization design, process structuring, and operational alignment.'),
  ('Service Sélection et Recrutement', 'SSR', 'Recruitment campaigns, candidate selection, and onboarding coordination.'),
  ('Service Gestion des Carrières', 'SGC', 'Career path management, promotions, and mobility planning.'),
  ('Département Formation', 'DFORM', 'Training governance, annual training plans, and learning oversight.'),
  ('Service Planification et Suivi de la Formation Continue', 'SPSFC', 'Continuous training planning and training progress monitoring.'),
  ('Service Gestion de la Formation Continue et de l''Apprentissage', 'SGFCA', 'Continuous learning administration and apprenticeship management.'),
  ('Département Informatique', 'IT', 'Information systems, applications, infrastructure, and user support.'),
  ('Département Finance et Comptabilité', 'FIN', 'Financial control, accounting operations, and reporting.'),
  ('Département Achats et Approvisionnement', 'DAA', 'Purchasing, sourcing, supplier management, and procurement operations.'),
  ('Département Logistique', 'LOG', 'Transport, warehousing, stock coordination, and field logistics.'),
  ('Département Administration Générale', 'DAG', 'General administration, facilities, and support services.'),
  ('Département HSE', 'HSE', 'Health, safety, environment, and prevention management.'),
  ('Département Juridique', 'JUR', 'Legal review, contracts, litigation follow-up, and regulatory support.')
ON CONFLICT (nom) DO UPDATE
SET
  code = EXCLUDED.code,
  description = EXCLUDED.description,
  updated_at = now();
