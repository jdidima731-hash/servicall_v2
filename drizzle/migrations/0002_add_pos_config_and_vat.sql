-- Migration: Add POS Configuration and VAT
-- Description: Ajoute la configuration POS à tenants et le taux de TVA à business_entities
-- Date: 2026-02-18

-- ============================================
-- STEP 1: Create POS Provider Enum
-- ============================================

DO $$ BEGIN
  CREATE TYPE "pos_provider" AS ENUM (
    'lightspeed',
    'sumup',
    'zettle',
    'square',
    'tiller',
    'none'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- STEP 2: Add columns to tenants table
-- ============================================

ALTER TABLE "tenants" 
  ADD COLUMN IF NOT EXISTS "pos_provider" "pos_provider" DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "pos_config" JSONB,
  ADD COLUMN IF NOT EXISTS "pos_sync_enabled" BOOLEAN DEFAULT false;

-- ============================================
-- STEP 3: Add VAT column to business_entities
-- ============================================

ALTER TABLE "business_entities" 
  ADD COLUMN IF NOT EXISTS "vat_rate" NUMERIC(5, 2) DEFAULT 20.00;

-- ============================================
-- STEP 4: Create pos_orders table for sync tracking
-- ============================================

CREATE TABLE IF NOT EXISTS "pos_orders" (
  "id" INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "tenant_id" INTEGER NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "crm_order_id" VARCHAR(255), -- ID de commande interne (ex: de restaurant_orders)
  "pos_order_id" VARCHAR(255), -- ID de commande dans le système POS externe
  "provider" "pos_provider" NOT NULL,
  "status" VARCHAR(50) NOT NULL, -- 'pending', 'synced', 'failed', 'cancelled'
  "total_amount" NUMERIC(10, 2) NOT NULL,
  "vat_amount" NUMERIC(10, 2) NOT NULL,
  "sync_log" JSONB, -- Logs d'erreurs ou détails API
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- STEP 5: Create indexes for pos_orders
-- ============================================

CREATE INDEX IF NOT EXISTS "idx_pos_orders_tenant_id" ON "pos_orders" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_pos_orders_crm_id" ON "pos_orders" ("crm_order_id");
CREATE INDEX IF NOT EXISTS "idx_pos_orders_pos_id" ON "pos_orders" ("pos_order_id");
CREATE INDEX IF NOT EXISTS "idx_pos_orders_tenant_provider" ON "pos_orders" ("tenant_id", "provider");

-- ============================================
-- STEP 6: Enable RLS on pos_orders
-- ============================================

ALTER TABLE "pos_orders" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_pos_orders"
  ON "pos_orders"
  FOR ALL
  USING ("tenant_id" = NULLIF(current_setting('app.tenant_id', TRUE), '')::INTEGER);

-- ============================================
-- STEP 7: Add trigger for updated_at
-- ============================================

CREATE TRIGGER trigger_pos_orders_updated_at
  BEFORE UPDATE ON "pos_orders"
  FOR EACH ROW
  EXECUTE FUNCTION update_business_entities_updated_at();

-- ============================================
-- ROLLBACK INSTRUCTIONS (commented)
-- ============================================

-- To rollback:
-- DROP TABLE IF EXISTS "pos_orders";
-- ALTER TABLE "business_entities" DROP COLUMN IF EXISTS "vat_rate";
-- ALTER TABLE "tenants" DROP COLUMN IF EXISTS "pos_sync_enabled";
-- ALTER TABLE "tenants" DROP COLUMN IF EXISTS "pos_config";
-- ALTER TABLE "tenants" DROP COLUMN IF EXISTS "pos_provider";
-- DROP TYPE IF EXISTS "pos_provider";
