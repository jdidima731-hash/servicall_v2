# Servicall V2.0 — Guide de Déploiement Production

Ce guide détaille les étapes pour déployer Servicall V2 sur un serveur Ubuntu (VPS/Dédié).

## 📋 Prérequis Système

- **OS** : Ubuntu 22.04 LTS ou supérieur
- **Node.js** : v22.x (LTS recommandée)
- **Gestionnaire de paquets** : pnpm v9+
- **Base de données** : PostgreSQL 14+
- **Cache & Queues** : Redis 6+
- **Process Manager** : PM2 (`sudo npm install -g pm2`)
- **Serveur Web** : Nginx (Reverse Proxy)

## 🚀 Installation Rapide

### 1. Cloner et Installer
```bash
# Extraire l'archive
unzip servicall_final.zip -d servicall
cd servicall

# Installer les dépendances
pnpm install
```

### 2. Configuration de l'Environnement
```bash
cp .env.example .env
# ÉDITEZ LE FICHIER .env AVEC VOS VALEURS RÉELLES
nano .env
```

### 3. Initialisation de la Base de Données
```bash
# Pousser le schéma Drizzle vers PostgreSQL
pnpm run db:push

# Initialiser l'administrateur par défaut
pnpm run admin:init
```

### 4. Build de l'Application
```bash
pnpm run build
```

## ⚙️ Gestion des Processus (PM2)

Nous utilisons PM2 pour garantir que l'application reste en ligne 24/7.

```bash
# Démarrer l'application avec la configuration ecosystem
pm2 start ecosystem.config.js

# Sauvegarder la liste des processus pour le redémarrage serveur
pm2 save
pm2 startup
```

**Commandes utiles :**
- `pm2 logs servicall` : Voir les logs en temps réel
- `pm2 status` : Voir l'état des processus
- `pm2 restart servicall` : Redémarrer l'application

## 🌐 Configuration Nginx (Reverse Proxy)

Créez un fichier de configuration Nginx : `/etc/nginx/sites-available/servicall`

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Sécurité : Limiter la taille des uploads
    client_max_body_size 10M;
}
```

Activez le site et installez SSL avec Certbot :
```bash
sudo ln -s /etc/nginx/sites-available/servicall /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d votre-domaine.com
```

## 🛠️ Maintenance & Monitoring

- **Logs applicatifs** : Situés dans le dossier `logs/` (configuré dans `ecosystem.config.js`).
- **Health Check** : `GET /healthz` ou `GET /health` pour vérifier l'état des services (DB, Redis, Queues).
- **Métriques Prometheus** : Disponibles sur `/metrics` (si activé).

## 🔐 Sécurité Production

1. **Secrets** : Assurez-vous que `SESSION_SECRET` et `ENCRYPTION_KEY` sont des chaînes aléatoires fortes.
2. **CORS** : Configurez `ALLOWED_ORIGINS` dans le `.env` avec votre domaine réel.
3. **Webhooks** : Configurez `STRIPE_WEBHOOK_SECRET` et `TWILIO_AUTH_TOKEN` pour sécuriser les points d'entrée API.
4. **Mode Démo** : Assurez-vous que `DB_ENABLED=true` et `MODE_TEST=false` en production.

---
*Support Technique : https://help.manus.im*
