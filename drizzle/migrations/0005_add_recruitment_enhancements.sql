-- Migration: Améliorations du Module de Recrutement IA
-- Description: Ajoute les tables pour CV, exigences IA, créneaux RDV et améliore candidate_interviews

-- ============================================
-- ÉTAPE 1: Ajouter les nouvelles colonnes à candidate_interviews
-- ============================================
ALTER TABLE candidate_interviews
  ADD COLUMN IF NOT EXISTS job_offer_id INTEGER,
  ADD COLUMN IF NOT EXISTS cv_url TEXT,
  ADD COLUMN IF NOT EXISTS cv_file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cv_parsed_data JSON,
  ADD COLUMN IF NOT EXISTS matching_score DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS matching_details JSON,
  ADD COLUMN IF NOT EXISTS sent_to_client BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_to_client_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS client_feedback TEXT,
  ADD COLUMN IF NOT EXISTS client_decision VARCHAR(50);

-- ============================================
-- ÉTAPE 2: Créer la table recruitment_job_requirements
-- ============================================
CREATE TABLE IF NOT EXISTS recruitment_job_requirements (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_offer_id INTEGER,
  title VARCHAR(255) NOT NULL,
  client_requirements_raw TEXT,
  ai_generated_profile JSON,
  conversation_history JSON,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recruitment_job_req_tenant_id_idx ON recruitment_job_requirements(tenant_id);
CREATE INDEX IF NOT EXISTS recruitment_job_req_is_active_idx ON recruitment_job_requirements(is_active);

-- ============================================
-- ÉTAPE 3: Créer la table recruitment_rdv_slots
-- ============================================
CREATE TABLE IF NOT EXISTS recruitment_rdv_slots (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slot_date TIMESTAMP NOT NULL,
  slot_duration INTEGER DEFAULT 30,
  is_available BOOLEAN DEFAULT true,
  interview_id INTEGER,
  assigned_to VARCHAR(255),
  interview_type VARCHAR(50) DEFAULT 'phone',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recruitment_rdv_slots_tenant_id_idx ON recruitment_rdv_slots(tenant_id);
CREATE INDEX IF NOT EXISTS recruitment_rdv_slots_slot_date_idx ON recruitment_rdv_slots(slot_date);
CREATE INDEX IF NOT EXISTS recruitment_rdv_slots_is_available_idx ON recruitment_rdv_slots(is_available);

-- ============================================
-- ÉTAPE 4: Ajouter les colonnes manquantes à job_offers
-- ============================================
ALTER TABLE job_offers
  ADD COLUMN IF NOT EXISTS requirements_id INTEGER,
  ADD COLUMN IF NOT EXISTS skills_required JSON,
  ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS education_level VARCHAR(100),
  ADD COLUMN IF NOT EXISTS remote_work VARCHAR(50) DEFAULT 'onsite',
  ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS application_deadline TIMESTAMP,
  ADD COLUMN IF NOT EXISTS positions_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS filled_positions INTEGER DEFAULT 0;

-- ============================================
-- ÉTAPE 5: Triggers pour updated_at automatique
-- ============================================
CREATE OR REPLACE FUNCTION update_recruitment_enhanced_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recruitment_job_requirements_updated_at ON recruitment_job_requirements;
CREATE TRIGGER recruitment_job_requirements_updated_at
  BEFORE UPDATE ON recruitment_job_requirements
  FOR EACH ROW
  EXECUTE FUNCTION update_recruitment_enhanced_updated_at();

DROP TRIGGER IF EXISTS recruitment_rdv_slots_updated_at ON recruitment_rdv_slots;
CREATE TRIGGER recruitment_rdv_slots_updated_at
  BEFORE UPDATE ON recruitment_rdv_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_recruitment_enhanced_updated_at();

-- ============================================
-- ÉTAPE 6: RLS pour multi-tenant strict
-- ============================================
ALTER TABLE recruitment_job_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_rdv_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recruitment_job_req_tenant_isolation ON recruitment_job_requirements;
CREATE POLICY recruitment_job_req_tenant_isolation ON recruitment_job_requirements
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

DROP POLICY IF EXISTS recruitment_rdv_slots_tenant_isolation ON recruitment_rdv_slots;
CREATE POLICY recruitment_rdv_slots_tenant_isolation ON recruitment_rdv_slots
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- ============================================
-- ÉTAPE 7: Commentaires pour documentation
-- ============================================
COMMENT ON TABLE recruitment_job_requirements IS 'Exigences client définies via IA pour le recrutement';
COMMENT ON TABLE recruitment_rdv_slots IS 'Créneaux de RDV disponibles pour les entretiens';
COMMENT ON COLUMN candidate_interviews.cv_url IS 'URL du CV uploadé par le candidat';
COMMENT ON COLUMN candidate_interviews.matching_score IS 'Score de matching IA candidat/offre (0-100)';
COMMENT ON COLUMN candidate_interviews.sent_to_client IS 'Indique si le profil a été envoyé au client';
