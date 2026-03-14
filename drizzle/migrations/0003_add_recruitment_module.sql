-- Migration: Module de Recrutement IA
-- Description: Ajoute les tables pour les entretiens IA automatisés, questions métier et configuration

-- Création des ENUMs
DO $$ BEGIN
  CREATE TYPE interview_status AS ENUM (
    'pending',
    'scheduled',
    'in_progress',
    'completed',
    'reviewed',
    'shortlisted',
    'rejected',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE candidate_source AS ENUM (
    'platform',
    'manual',
    'referral',
    'job_board',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE emotion AS ENUM (
    'confident',
    'nervous',
    'calm',
    'stressed',
    'enthusiastic',
    'neutral',
    'defensive',
    'uncertain'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Table: candidate_interviews
CREATE TABLE IF NOT EXISTS candidate_interviews (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Informations candidat (chiffrées)
  candidate_name TEXT,
  candidate_email TEXT,
  candidate_phone TEXT,
  
  -- Métier et configuration
  business_type VARCHAR(100) NOT NULL,
  job_position VARCHAR(255) NOT NULL,
  
  -- Planification et exécution
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER,
  
  -- Statut et source
  status interview_status DEFAULT 'pending',
  source candidate_source DEFAULT 'platform',
  
  -- Données d'appel
  call_sid VARCHAR(255),
  recording_url TEXT,
  
  -- Transcript et analyse
  transcript TEXT,
  notes_json JSON,
  
  -- Résumé et recommandation
  ai_summary TEXT,
  ai_recommendation VARCHAR(50),
  ai_confidence DECIMAL(5, 2),
  
  -- Métadonnées
  metadata JSON,
  
  -- Notes employeur
  employer_notes TEXT,
  employer_decision VARCHAR(50),
  employer_decision_at TIMESTAMP,
  
  -- Conformité RGPD
  consent_given BOOLEAN DEFAULT false,
  data_retention_until TIMESTAMP,
  anonymized BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour candidate_interviews
CREATE INDEX IF NOT EXISTS candidate_interviews_tenant_id_idx ON candidate_interviews(tenant_id);
CREATE INDEX IF NOT EXISTS candidate_interviews_tenant_business_idx ON candidate_interviews(tenant_id, business_type);
CREATE INDEX IF NOT EXISTS candidate_interviews_tenant_status_idx ON candidate_interviews(tenant_id, status);
CREATE INDEX IF NOT EXISTS candidate_interviews_status_idx ON candidate_interviews(status);
CREATE INDEX IF NOT EXISTS candidate_interviews_business_type_idx ON candidate_interviews(business_type);
CREATE INDEX IF NOT EXISTS candidate_interviews_scheduled_at_idx ON candidate_interviews(scheduled_at);
CREATE INDEX IF NOT EXISTS candidate_interviews_created_at_idx ON candidate_interviews(created_at DESC);
CREATE INDEX IF NOT EXISTS candidate_interviews_tenant_business_status_idx ON candidate_interviews(tenant_id, business_type, status);
CREATE UNIQUE INDEX IF NOT EXISTS candidate_interviews_call_sid_idx ON candidate_interviews(call_sid);

-- Table: interview_questions
CREATE TABLE IF NOT EXISTS interview_questions (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  
  business_type VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  
  question TEXT NOT NULL,
  expected_answer_type VARCHAR(50),
  expected_keywords JSON,
  
  weight DECIMAL(5, 2) DEFAULT 1.00,
  is_active BOOLEAN DEFAULT true,
  
  "order" INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour interview_questions
CREATE INDEX IF NOT EXISTS interview_questions_business_type_idx ON interview_questions(business_type);
CREATE INDEX IF NOT EXISTS interview_questions_tenant_business_idx ON interview_questions(tenant_id, business_type);
CREATE INDEX IF NOT EXISTS interview_questions_is_active_idx ON interview_questions(is_active);

-- Table: recruitment_settings
CREATE TABLE IF NOT EXISTS recruitment_settings (
  id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  business_type VARCHAR(100) NOT NULL,
  
  -- Scores minimaux
  min_global_score DECIMAL(5, 2) DEFAULT 6.00,
  min_coherence_score DECIMAL(5, 2) DEFAULT 7.00,
  min_honesty_score DECIMAL(5, 2) DEFAULT 7.00,
  
  -- Configuration IA
  ai_model VARCHAR(100) DEFAULT 'gpt-4o-mini',
  ai_temperature DECIMAL(3, 2) DEFAULT 0.70,
  
  -- Scripts personnalisés
  custom_intro_script TEXT,
  custom_outro_script TEXT,
  
  -- Notifications
  notify_on_completion BOOLEAN DEFAULT true,
  notification_email TEXT,
  
  -- Rétention des données
  data_retention_days INTEGER DEFAULT 90,
  
  -- Actif/Inactif
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour recruitment_settings
CREATE UNIQUE INDEX IF NOT EXISTS recruitment_settings_tenant_business_unique_idx ON recruitment_settings(tenant_id, business_type);
CREATE INDEX IF NOT EXISTS recruitment_settings_tenant_id_idx ON recruitment_settings(tenant_id);

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_recruitment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidate_interviews_updated_at
  BEFORE UPDATE ON candidate_interviews
  FOR EACH ROW
  EXECUTE FUNCTION update_recruitment_updated_at();

CREATE TRIGGER interview_questions_updated_at
  BEFORE UPDATE ON interview_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_recruitment_updated_at();

CREATE TRIGGER recruitment_settings_updated_at
  BEFORE UPDATE ON recruitment_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_recruitment_updated_at();

-- RLS (Row Level Security) pour multi-tenant strict
ALTER TABLE candidate_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_settings ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour candidate_interviews
CREATE POLICY candidate_interviews_tenant_isolation ON candidate_interviews
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- Politique RLS pour interview_questions (permet questions universelles)
CREATE POLICY interview_questions_tenant_isolation ON interview_questions
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::INTEGER
    OR tenant_id IS NULL
  );

-- Politique RLS pour recruitment_settings
CREATE POLICY recruitment_settings_tenant_isolation ON recruitment_settings
  USING (tenant_id = current_setting('app.current_tenant_id', true)::INTEGER);

-- Commentaires pour documentation
COMMENT ON TABLE candidate_interviews IS 'Stocke tous les entretiens IA des candidats avec analyse comportementale';
COMMENT ON TABLE interview_questions IS 'Questions métier configurables par type d''activité';
COMMENT ON TABLE recruitment_settings IS 'Configuration du module de recrutement par tenant et métier';

COMMENT ON COLUMN candidate_interviews.notes_json IS 'Scores, analyse comportementale, émotions, signaux d''alerte';
COMMENT ON COLUMN candidate_interviews.transcript IS 'Transcript complet de l''entretien IA';
COMMENT ON COLUMN candidate_interviews.ai_confidence IS 'Niveau de confiance de la recommandation IA (0-100)';
