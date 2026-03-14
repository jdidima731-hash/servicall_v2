-- ✅ CORRECTION BUG COACHING: Migration pour corriger la table simulated_calls
-- Problèmes corrigés:
-- 1. id: varchar(255) UUID au lieu de integer auto-increment
-- 2. transcript: json au lieu de text
-- 3. feedback: json au lieu de text
-- 4. Ajout colonnes manquantes: scenario_name, objectives_achieved, started_at, completed_at, updated_at
-- 5. FK agentId: référence users.id (pas tenants.id)

-- Étape 1: Sauvegarder les données existantes
CREATE TABLE IF NOT EXISTS "simulated_calls_backup" AS SELECT * FROM "simulated_calls";

-- Étape 2: Supprimer la table existante
DROP TABLE IF EXISTS "simulated_calls" CASCADE;

-- Étape 3: Recréer la table avec le bon schéma
CREATE TABLE "simulated_calls" (
  "id" varchar(255) PRIMARY KEY NOT NULL,
  "tenant_id" integer NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "agent_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "scenario_id" varchar(255),
  "scenario_name" varchar(255),
  "status" text DEFAULT 'in_progress',
  "duration" integer DEFAULT 0,
  "score" integer DEFAULT 0,
  "transcript" json,
  "feedback" json,
  "objectives_achieved" json,
  "metadata" json,
  "started_at" timestamp DEFAULT now(),
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Étape 4: Recréer les index
CREATE INDEX "simulated_calls_tenant_id_idx" ON "simulated_calls" USING btree ("tenant_id");
CREATE INDEX "simulated_calls_agent_id_idx" ON "simulated_calls" USING btree ("agent_id");
CREATE INDEX "simulated_calls_scenario_id_idx" ON "simulated_calls" USING btree ("scenario_id");

-- Note: Les données de la sauvegarde ne sont pas migrées car le type id a changé (integer -> varchar)
-- La table backup peut être supprimée manuellement après validation: DROP TABLE simulated_calls_backup;
