#!/bin/bash
# ============================================================
# SERVICALL v2.0 - Script de déploiement complet
# ============================================================
set -e

echo "============================================"
echo "  SERVICALL v2.0 - Setup Complet"
echo "============================================"

# 1. Vérification des prérequis
echo "[1/6] Vérification des prérequis..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js requis"; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "❌ PostgreSQL requis"; exit 1; }
command -v redis-cli >/dev/null 2>&1 || { echo "❌ Redis requis"; exit 1; }
echo "✅ Prérequis OK"

# 2. Chargement des variables d'environnement
echo "[2/6] Chargement de la configuration..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Fichier .env créé depuis .env.example - Configurez vos valeurs!"
fi
source .env 2>/dev/null || true
echo "✅ Configuration chargée"

# 3. Installation des dépendances
echo "[3/6] Installation des dépendances Node.js..."
pnpm install --frozen-lockfile
echo "✅ Dépendances installées"

# 4. Migration de la base de données
echo "[4/6] Migration de la base de données..."
pnpm exec drizzle-kit push
echo "✅ Base de données migrée"

# 5. Création du compte admin
echo "[5/6] Initialisation du compte admin..."
node -e "
import('dotenv/config').then(async () => {
  const bcrypt = await import('bcryptjs');
  const { Client } = await import('pg');
  const { nanoid } = await import('nanoid');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const check = await client.query('SELECT id FROM users WHERE role = \$1 LIMIT 1', ['admin']);
  if (check.rows.length > 0) {
    console.log('✅ Compte admin existe déjà (ID:', check.rows[0].id + ')');
  } else {
    const email = process.env.ADMIN_EMAIL || 'admin@servicall.com';
    const password = process.env.ADMIN_PASSWORD || 'Admin@2026!';
    const hash = await bcrypt.hash(password, 12);
    const openId = nanoid();
    const result = await client.query(
      'INSERT INTO users (open_id, email, name, password_hash, login_method, role, last_signed_in) VALUES (\$1, \$2, \$3, \$4, \$5, \$6, NOW()) RETURNING id',
      [openId, email, 'Admin Servicall', hash, 'password', 'admin']
    );
    const adminId = result.rows[0].id;
    const tenantResult = await client.query(
      'INSERT INTO tenants (slug, name, is_active, settings) VALUES (\$1, \$2, true, \$3) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      ['default', 'ServiceCall Default', '{}']
    );
    const tenantId = tenantResult.rows[0].id;
    await client.query(
      'INSERT INTO tenant_users (user_id, tenant_id, role, is_active) VALUES (\$1, \$2, \$3, true) ON CONFLICT DO NOTHING',
      [adminId, tenantId, 'owner']
    );
    console.log('✅ Admin créé:', email, '/ Mot de passe:', password);
  }
  await client.end();
});
"

# 6. Build de production
echo "[6/6] Build de production..."
NODE_OPTIONS='--max-old-space-size=8192' pnpm exec vite build
pnpm exec esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo ""
echo "============================================"
echo "  ✅ SETUP TERMINÉ AVEC SUCCÈS!"
echo "============================================"
echo ""
echo "Pour démarrer le serveur:"
echo "  NODE_ENV=production node dist/index.js"
echo ""
echo "Compte admin:"
echo "  Email: ${ADMIN_EMAIL:-admin@servicall.com}"
echo "  Mot de passe: ${ADMIN_PASSWORD:-Admin@2026!}"
echo ""
