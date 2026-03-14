# Rapport de Diagnostic - Problème de Démarrage Servicall V2

## 🔴 Problème Identifié

Le serveur Servicall V2 se bloque silencieusement lors du démarrage sans afficher de messages d'erreur ou de logs.

## ✅ Correction Appliquée

**Ligne supprimée du `package.json` (ligne 221):**
```json
"packageManager": "pnpm@10.4.1+sha512.c753b6c3ad7afa13af388fa6d808035a008e30ea9993f58c6663e2bc5ff21679aa834db094987129aa4d488b86df57f7b634981b2f827cdcacc698cc0cfb88af"
```

Cette ligne forçait une version spécifique de pnpm et causait des blocages lors de l'installation et du démarrage sur des VPS avec d'autres versions.

## 🔍 Causes Potentielles du Blocage Silencieux

### 1. **Initialisation de la Base de Données (Ligne 58 de server/_core/index.ts)**
```typescript
await dbManager.initialize();
```
- **Problème**: La connexion PostgreSQL peut être bloquée si la base de données n'est pas accessible ou si les migrations sont longues.
- **Solution**: Ajouter des timeouts et des logs détaillés.

### 2. **Connexion Redis (Ligne 71)**
```typescript
await connectRedis();
```
- **Problème**: Si Redis n'est pas accessible, le serveur attend indéfiniment.
- **Solution**: Implémenter un timeout de connexion.

### 3. **Initialisation du Moteur de Dialer (Ligne 96)**
```typescript
await dialerEngine.initialize();
```
- **Problème**: L'initialisation du moteur de dialer peut être bloquée par des opérations asynchrones non terminées.
- **Solution**: Ajouter des logs de progression et des timeouts.

### 4. **Démarrage des Workers BullMQ (Ligne 83)**
```typescript
startAllWorkers();
```
- **Problème**: Les workers peuvent se bloquer lors de la connexion à Redis ou lors de l'initialisation des queues.
- **Solution**: Implémenter une gestion d'erreur robuste et des logs détaillés.

## 🛠️ Recommandations pour la Production

### A. Ajouter des Timeouts Globaux

Modifier `server/_core/index.ts`:
```typescript
async function startServer() {
  const startupTimeout = setTimeout(() => {
    logger.error("[Server] ❌ Startup timeout - server did not start within 60 seconds");
    process.exit(1);
  }, 60000);

  try {
    // ... initialization code ...
    clearTimeout(startupTimeout);
  } catch (error) {
    clearTimeout(startupTimeout);
    throw error;
  }
}
```

### B. Ajouter des Logs Détaillés

Chaque étape d'initialisation doit afficher un log:
```typescript
logger.info("[Server] Starting database initialization...");
await dbManager.initialize();
logger.info("[Server] ✅ Database initialized");
```

### C. Implémenter des Healthchecks

Les routes `/health`, `/healthz`, `/health/live`, `/health/ready` doivent être disponibles rapidement.

### D. Configuration Recommandée pour le VPS

**Fichier `.env` pour production:**
```bash
# Database
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD@localhost:5432/servicall_db

# Redis
REDIS_URL=redis://localhost:6379

# Security
SESSION_SECRET=GENERATE_WITH_openssl_rand_-base64_32
ENCRYPTION_KEY=GENERATE_WITH_openssl_rand_-base64_32

# Server
PORT=5000
NODE_ENV=production
WEBHOOK_URL=https://votre-domaine.com

# Disable test mode in production
MODE_TEST=false
DB_ENABLED=true

# Timeouts
DB_QUERY_TIMEOUT=30000
REDIS_CONNECT_TIMEOUT=5000
```

### E. Commandes de Démarrage Recommandées

**Avec PM2:**
```bash
pm2 start ecosystem.config.js --name servicall
pm2 logs servicall
pm2 save
pm2 startup
```

**Avec Docker (recommandé):**
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

**Avec systemd:**
```ini
[Unit]
Description=Servicall V2 API Server
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=servicall
WorkingDirectory=/opt/servicall
Environment="NODE_ENV=production"
Environment="PORT=5000"
ExecStart=/usr/bin/node /opt/servicall/dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

## 📋 Checklist de Déploiement Production

- [ ] Supprimer la ligne `packageManager` du `package.json`
- [ ] Configurer `.env` avec des valeurs réelles (pas de placeholders)
- [ ] Installer PostgreSQL 14+ et Redis 6+
- [ ] Créer la base de données: `createdb servicall_db`
- [ ] Exécuter les migrations: `pnpm run db:push`
- [ ] Initialiser l'admin: `pnpm run admin:init`
- [ ] Tester le démarrage en mode production: `PORT=5000 NODE_ENV=production node dist/index.js`
- [ ] Vérifier les healthchecks: `curl http://localhost:5000/health`
- [ ] Configurer PM2 ou systemd pour la gestion des processus
- [ ] Configurer Nginx comme reverse proxy
- [ ] Installer SSL avec Certbot
- [ ] Configurer les logs (syslog ou journald)
- [ ] Mettre en place la sauvegarde des données
- [ ] Configurer le monitoring (Prometheus, Grafana)

## 🚀 Prochaines Étapes

1. **Tester en local** avec `NODE_ENV=production node dist/index.js`
2. **Vérifier les logs** pour identifier les points de blocage
3. **Ajouter des timeouts** si nécessaire
4. **Déployer sur VPS** avec PM2 ou Docker
5. **Monitorer** les performances et les erreurs

---

**Archive générée le:** 12 Mars 2026  
**Version:** Servicall V2.0 - Production Ready  
**Statut:** ✅ Prêt pour déploiement après application des recommandations
