-- ============================================
-- BLOC 2 - Sécurité PostgreSQL RLS
-- Activation de Row Level Security sur les tables critiques
-- ============================================

-- Ce script active la RLS et crée des politiques strictes
-- pour garantir l'isolation totale des données par tenant

-- ============================================
-- 1. ACTIVER RLS SUR LES TABLES CRITIQUES
-- ============================================

-- Table prospects
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- Table calls
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

-- Table messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Table workflows
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- Table campaigns (si elle existe)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- ============================================
-- 2. CRÉER LES POLITIQUES RLS
-- ============================================

-- Politique pour PROSPECTS
-- Les utilisateurs ne peuvent accéder qu'aux prospects de leur tenant
DROP POLICY IF EXISTS tenant_isolation_policy ON prospects;
CREATE POLICY tenant_isolation_policy ON prospects
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER);

-- Politique pour CALLS
-- Les utilisateurs ne peuvent accéder qu'aux appels de leur tenant
DROP POLICY IF EXISTS tenant_isolation_policy ON calls;
CREATE POLICY tenant_isolation_policy ON calls
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER);

-- Politique pour MESSAGES
-- Les utilisateurs ne peuvent accéder qu'aux messages de leur tenant
DROP POLICY IF EXISTS tenant_isolation_policy ON messages;
CREATE POLICY tenant_isolation_policy ON messages
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER);

-- Politique pour WORKFLOWS
-- Les utilisateurs ne peuvent accéder qu'aux workflows de leur tenant
DROP POLICY IF EXISTS tenant_isolation_policy ON workflows;
CREATE POLICY tenant_isolation_policy ON workflows
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', TRUE), '')::INTEGER);

-- Politique pour CAMPAIGNS (si elle existe)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        EXECUTE 'DROP POLICY IF EXISTS tenant_isolation_policy ON campaigns';
        EXECUTE 'CREATE POLICY tenant_isolation_policy ON campaigns
                 USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', TRUE), '''')::INTEGER)';
    END IF;
END $$;

-- ============================================
-- 3. VÉRIFICATION DE L'ACTIVATION RLS
-- ============================================

-- Cette requête permet de vérifier que la RLS est bien activée
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('prospects', 'calls', 'messages', 'workflows', 'campaigns')
ORDER BY tablename;

-- ============================================
-- 4. VÉRIFICATION DES POLITIQUES
-- ============================================

-- Cette requête liste toutes les politiques RLS créées
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN ('prospects', 'calls', 'messages', 'workflows', 'campaigns')
ORDER BY tablename, policyname;

-- ============================================
-- NOTES IMPORTANTES
-- ============================================

-- 1. Le paramètre 'app.current_tenant_id' DOIT être défini par le middleware
--    backend avant chaque requête SQL
--
-- 2. Format de définition du paramètre :
--    SET LOCAL app.current_tenant_id = '123';
--
-- 3. La fonction NULLIF gère le cas où le paramètre n'est pas défini
--    (retourne NULL au lieu d'une erreur)
--
-- 4. Les politiques utilisent USING (pas WITH CHECK) pour s'appliquer
--    à SELECT, UPDATE, DELETE. Pour INSERT, ajouter WITH CHECK si nécessaire.
--
-- 5. Pour désactiver temporairement la RLS (admin uniquement) :
--    SET SESSION AUTHORIZATION DEFAULT;
--    ou utiliser un rôle avec BYPASSRLS
