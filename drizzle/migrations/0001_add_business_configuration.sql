-- Migration: Add Business Configuration
-- Description: Ajoute la table business_entities et les champs business_type/ai_custom_script à tenants
-- Date: 2026-02-18

-- ============================================
-- STEP 1: Create ENUMS
-- ============================================

-- Business type enum
DO $$ BEGIN
  CREATE TYPE "business_type" AS ENUM (
    'restaurant',
    'hotel',
    'real_estate',
    'clinic',
    'ecommerce',
    'artisan',
    'call_center',
    'generic'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Entity type enum
DO $$ BEGIN
  CREATE TYPE "entity_type" AS ENUM (
    'product',
    'service',
    'property',
    'room',
    'appointment',
    'menu_item',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- STEP 2: Add columns to tenants table
-- ============================================

ALTER TABLE "tenants" 
  ADD COLUMN IF NOT EXISTS "business_type" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "ai_custom_script" TEXT;

-- ============================================
-- STEP 3: Create business_entities table
-- ============================================

CREATE TABLE IF NOT EXISTS "business_entities" (
  "id" INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "type" "entity_type" NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "price" NUMERIC(10, 2),
  "availability_json" JSONB,
  "metadata_json" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 4: Create indexes for business_entities
-- ============================================

CREATE INDEX IF NOT EXISTS "idx_business_entities_tenant_id" ON "business_entities" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_business_entities_type" ON "business_entities" ("type");
CREATE INDEX IF NOT EXISTS "idx_business_entities_is_active" ON "business_entities" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_business_entities_tenant_type" ON "business_entities" ("tenant_id", "type");
CREATE INDEX IF NOT EXISTS "idx_business_entities_tenant_active" ON "business_entities" ("tenant_id", "is_active");

-- ============================================
-- STEP 5: Enable RLS on business_entities
-- ============================================

ALTER TABLE "business_entities" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's entities
DROP POLICY IF EXISTS "tenant_isolation_business_entities" ON "business_entities";
CREATE POLICY "tenant_isolation_business_entities"
  ON "business_entities"
  FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', TRUE), '')::INTEGER);

-- ============================================
-- STEP 6: Add trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_business_entities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_business_entities_updated_at
  BEFORE UPDATE ON "business_entities"
  FOR EACH ROW
  EXECUTE FUNCTION update_business_entities_updated_at();

-- ============================================
-- ROLLBACK INSTRUCTIONS (commented)
-- ============================================

-- To rollback this migration, execute:
-- DROP TRIGGER IF EXISTS trigger_business_entities_updated_at ON "business_entities";
-- DROP FUNCTION IF EXISTS update_business_entities_updated_at();
-- DROP POLICY IF EXISTS "tenant_isolation_business_entities" ON "business_entities";
-- DROP TABLE IF EXISTS "business_entities";
-- ALTER TABLE "tenants" DROP COLUMN IF EXISTS "ai_custom_script";
-- ALTER TABLE "tenants" DROP COLUMN IF EXISTS "business_type";
-- DROP TYPE IF EXISTS "entity_type";
-- DROP TYPE IF EXISTS "business_type";
