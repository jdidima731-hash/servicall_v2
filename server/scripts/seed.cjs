const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.resolve(__dirname, '../../dev.db'));

console.log('[Seed] Initialisation des données de test...');

// Créer un tenant
const insertTenant = db.prepare(`
  INSERT OR IGNORE INTO tenants (id, name, created_at, updated_at)
  VALUES (1, 'Alpha Corp', datetime('now'), datetime('now'))
`);
insertTenant.run();
console.log('✓ Tenant "Alpha Corp" créé');

// Créer un utilisateur admin
const insertAdmin = db.prepare(`
  INSERT OR IGNORE INTO users (id, open_id, name, email, role, created_at, updated_at)
  VALUES (1, 'admin-open-id-123', 'Admin User', 'admin@alpha.com', 'admin', datetime('now'), datetime('now'))
`);
insertAdmin.run();
console.log('✓ Admin user créé: admin@alpha.com');

// Créer un utilisateur manager
const insertManager = db.prepare(`
  INSERT OR IGNORE INTO users (id, open_id, name, email, role, created_at, updated_at)
  VALUES (2, 'manager-open-id-456', 'Manager User', 'manager@alpha.com', 'user', datetime('now'), datetime('now'))
`);
insertManager.run();
console.log('✓ Manager user créé: manager@alpha.com');

// Créer un utilisateur agent
const insertAgent = db.prepare(`
  INSERT OR IGNORE INTO users (id, open_id, name, email, role, created_at, updated_at)
  VALUES (3, 'agent-open-id-789', 'Agent User', 'agent1@alpha.com', 'user', datetime('now'), datetime('now'))
`);
insertAgent.run();
console.log('✓ Agent user créé: agent1@alpha.com');

// Lier les utilisateurs au tenant
const insertTenantAdmin = db.prepare(`
  INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role, is_active, created_at, updated_at)
  VALUES (1, 1, 'admin', 1, datetime('now'), datetime('now'))
`);
insertTenantAdmin.run();

const insertTenantManager = db.prepare(`
  INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role, is_active, created_at, updated_at)
  VALUES (1, 2, 'manager', 1, datetime('now'), datetime('now'))
`);
insertTenantManager.run();

const insertTenantAgent = db.prepare(`
  INSERT OR IGNORE INTO tenant_users (tenant_id, user_id, role, is_active, created_at, updated_at)
  VALUES (1, 3, 'agent', 1, datetime('now'), datetime('now'))
`);
insertTenantAgent.run();

console.log('✓ Users linked to tenant');

db.close();

console.log('[Seed] ✅ Données de test créées avec succès');
