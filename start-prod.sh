#!/bin/bash
# Script de démarrage production Servicall v2
set -e

echo "🚀 Démarrage Servicall v2 en mode production..."

# Vérifier PostgreSQL
sudo service postgresql start 2>/dev/null || true

# Vérifier Redis
sudo service redis-server start 2>/dev/null || true

sleep 2

# Démarrer le serveur Node.js
cd /home/ubuntu/servicall_project
echo "▶ Démarrage du serveur Node.js sur le port 5000..."
NODE_ENV=production node dist/index.js
