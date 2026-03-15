# Servicall v2.0 🚀

Plateforme SaaS de gestion d'appels et services professionnels

## ✨ Fonctionnalités

- 📞 Gestion d'appels en temps réel
- 👥 Multi-utilisateurs avec rôles
- 💳 Facturation intégrée (Stripe)
- 🔐 Sécurité de niveau bancaire
- 📊 Dashboard analytique
- 🌐 API REST complète
- 🔌 WebSockets pour temps réel
- 📱 Responsive design

## 🚀 Démarrage rapide

```bash
# Cloner le projet
git clone https://github.com/jdidima731-hash/servicall_v2.git
cd servicall_v2

# Installer les dépendances
pnpm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Lancer les migrations
pnpm run db:push

# Démarrer en développement
pnpm run dev
📚 Documentation
API: http://localhost:3000/api

Health check: http://localhost:3000/health

WebSocket: ws://localhost:3000

🛠️ Stack technique
Frontend: React + TypeScript + Vite

Backend: Node.js + Express

Database: PostgreSQL + Drizzle ORM

Auth: Passport.js + JWT

Real-time: Socket.io

Payments: Stripe

Monitoring: Sentry

📦 Déploiement
bash
# Build
pnpm run build

# Démarrage production
pnpm run start:prod

# Avec Docker
docker-compose up -d
📝 Licence
Propriétaire - Tous droits réservés

