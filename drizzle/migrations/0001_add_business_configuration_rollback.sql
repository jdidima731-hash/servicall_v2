-- Rollback Migration: Add Business Configuration
-- Description: Supprime la table business_entities et les champs business_type/ai_custom_script de tenants
-- Date: 2026-02-18

-- ============================================
-- STEP 1: Drop trigger and function
-- ============================================

DROP TRIGGER IF EXISTS trigger_business_entities_updated_at ON "business_entities";
DROP FUNCTION IF EXISTS update_business_entities_updated_at();

-- ============================================
-- STEP 2: Drop RLS policy
-- ============================================

DROP POLICY IF EXISTS "tenant_isolation_business_entities" ON "business_entities";

-- ============================================
-- STEP 3: Drop business_entities table
-- ============================================

DROP TABLE IF EXISTS "business_entities";

-- ============================================
-- STEP 4: Remove columns from tenants table
-- ============================================

ALTER TABLE "tenants" DROP COLUMN IF EXISTS "ai_custom_script";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "business_type";

-- ============================================
-- STEP 5: Drop ENUMS
-- ============================================

DROP TYPE IF EXISTS "entity_type";
DROP TYPE IF EXISTS "business_type";
