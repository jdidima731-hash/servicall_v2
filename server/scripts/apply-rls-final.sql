-- ============================================
-- ISOLATION MULTI-TENANT (RLS)
-- ============================================

-- Désactiver le RLS si déjà présent pour repartir sur une base propre
DO $$ 
DECLARE 
    t text;
    tables text[] := ARRAY[
        'users', 'prospects', 'calls', 'appointments', 'workflows', 
        'workflow_steps', 'campaigns', 'simulated_calls', 'encryption_keys', 
        'compliance_logs', 'compliance_alerts', 'usage_metrics', 'documents', 
        'deals', 'tenant_industry_config', 'tenant_ai_keys', 'audit_ai_usage', 
        'message_templates', 'messages', 'ai_suggestions'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    END LOOP;
END $$;

-- 1. ACTIVER RLS SUR TOUTES LES TABLES MULTI-TENANT (Action 4)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulated_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_industry_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_ai_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

-- 2. CRÉER LES POLITIQUES RLS (Action 5)

-- Pour les tables avec une colonne tenant_id
DO $$ 
DECLARE 
    t text;
    tables_with_tenant text[] := ARRAY[
        'prospects', 'calls', 'appointments', 'workflows', 
        'campaigns', 'simulated_calls', 'encryption_keys', 
        'compliance_logs', 'compliance_alerts', 'usage_metrics', 'documents', 
        'deals', 'tenant_industry_config', 'tenant_ai_keys', 'audit_ai_usage', 
        'message_templates', 'messages', 'ai_suggestions'
    ];
BEGIN
    FOREACH t IN ARRAY tables_with_tenant LOOP
        EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'')::integer)', t);
    END LOOP;
END $$;

-- Pour la table users (isolation par ID utilisateur ou via tenant_users)
-- Note: Pour simplifier selon la demande, on applique une logique cohérente
CREATE POLICY tenant_isolation ON users 
USING (
    id IN (
        SELECT user_id FROM tenant_users 
        WHERE tenant_id = current_setting('app.tenant_id')::integer
    )
);

-- Pour workflow_steps (lié via workflow_id)
CREATE POLICY tenant_isolation ON workflow_steps
USING (
    workflow_id IN (
        SELECT id FROM workflows 
        WHERE tenant_id = current_setting('app.tenant_id')::integer
    )
);

-- Exception pour les admins (bypass RLS si besoin via rôle système ou config)
-- ALTER ROLE authenticator SET app.tenant_id = '0'; -- Exemple de bypass
