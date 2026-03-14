# Servicall v2 — Déploiement Production

## Résumé du déploiement

| Élément | Valeur |
|---------|--------|
| Application | Servicall v3.3 CRM SaaS |
| Port | 5000 |
| Node.js | v22.13.0 |
| Base de données | PostgreSQL 14 |
| Cache | Redis 6.0 |
| Build | Vite (frontend) + esbuild (backend) |

## Services actifs

- **PostgreSQL** : `postgresql://postgres:servicall_prod_2026@localhost:5432/servicall_db`
- **Redis** : `redis://localhost:6379`
- **Serveur Node.js** : `http://localhost:5000`

## Compte administrateur

| Champ | Valeur |
|-------|--------|
| Email | admin@servicall.com |
| Mot de passe | Admin2026@Secure |
| Rôle | admin |
| Tenant | ServiceCall Default |

## Commandes de démarrage

```bash
# Démarrer tous les services
sudo service postgresql start
sudo service redis-server start
cd /home/ubuntu/servicall_project
NODE_ENV=production node dist/index.js

# Ou utiliser le script tout-en-un
./start-prod.sh
```

## Rebuild complet

```bash
cd /home/ubuntu/servicall_project
pnpm install
NODE_OPTIONS='--max-old-space-size=8192' pnpm run build
```

## Health Check

```bash
curl http://localhost:5000/health
```

## Variables d'environnement requises (.env)

- `DATABASE_URL` — URL PostgreSQL
- `REDIS_URL` — URL Redis
- `SESSION_SECRET` — Secret de session (min 32 chars)
- `ENCRYPTION_KEY` — Clé de chiffrement (min 32 chars)
- `JWT_SECRET` — Secret JWT (min 32 chars)
- `CSRF_SECRET` — Secret CSRF (min 32 chars)
- `ENCRYPTION_SALT` — Sel de chiffrement
- `MASTER_KEY` — Clé maître (min 32 chars)
- `COOKIE_SECRET` — Secret cookie (min 32 chars)
