bash
#!/bin/bash

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}┌────────────────────────────────────┐${NC}"
echo -e "${BLUE}│${NC}    🚀 Servicall v2.0 - Déploiement    ${BLUE}│${NC}"
echo -e "${BLUE}└────────────────────────────────────┘${NC}"
echo ""

# Vérification des prérequis
echo -e "${YELLOW}📋 Vérification des prérequis...${NC}"

check_command() {
    if command -v $1 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $1 installé${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 requis${NC}"
        return 1
    fi
}

check_command node || exit 1
check_command pnpm || { echo -e "${YELLOW}📦 Installation de pnpm...${NC}"; npm install -g pnpm; }
check_command docker || echo -e "${YELLOW}⚠️ Docker optionnel${NC}"
check_command git || exit 1

echo ""

# Installation des dépendances
echo -e "${YELLOW}📦 Installation des dépendances...${NC}"
pnpm install --frozen-lockfile
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dépendances installées${NC}"
else
    echo -e "${RED}❌ Échec de l'installation${NC}"
    exit 1
fi

echo ""

# Vérification des variables d'environnement
echo -e "${YELLOW}🔐 Vérification des variables d'environnement...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}❌ Fichier .env manquant${NC}"
    echo -e "${YELLOW}📝 Création à partir de .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Fichier .env créé, veuillez le configurer${NC}"
    exit 1
fi

required_vars=("DATABASE_URL" "JWT_SECRET" "SESSION_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
    if grep -q "^${var}=" .env && ! grep -q "^${var}=$" .env; then
        echo -e "${GREEN}✅ ${var} configuré${NC}"
    else
        echo -e "${RED}❌ ${var} manquant ou vide${NC}"
        missing_vars+=($var)
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Variables d'environnement manquantes. Veuillez configurer .env${NC}"
    exit 1
fi

echo ""

# Build de l'application
echo -e "${YELLOW}🏗️  Build de l'application...${NC}"
pnpm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Build terminé${NC}"
else
    echo -e "${RED}❌ Échec du build${NC}"
    exit 1
fi

echo ""

# Migration de la base de données
echo -e "${YELLOW}🗃️  Migration de la base de données...${NC}"
pnpm run db:push
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Migration terminée${NC}"
else
    echo -e "${RED}❌ Échec de la migration${NC}"
    exit 1
fi

echo ""

# Tests
if [ "$NODE_ENV" != "production" ]; then
    echo -e "${YELLOW}🧪 Exécution des tests...${NC}"
    pnpm run test
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Tests échoués${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Tests passés${NC}"
fi

echo ""

# Démarrage de l'application
echo -e "${YELLOW}🚀 Démarrage de l'application...${NC}"

if command -v pm2 >/dev/null 2>&1; then
    echo -e "${BLUE}📊 Utilisation de PM2 pour la gestion des processus${NC}"
    NODE_ENV=${NODE_ENV:-production} pm2 start ecosystem.config.js
    pm2 save
    pm2 list
else
    echo -e "${BLUE}🔄 Démarrage direct avec Node${NC}"
    NODE_ENV=${NODE_ENV:-production} pnpm run start:prod &
fi

echo ""

# Vérification du déploiement
echo -e "${YELLOW}🔍 Vérification du déploiement...${NC}"
sleep 5

if curl -s http://localhost:3000/health > /dev/null; then
    HEALTH=$(curl -s http://localhost:3000/health)
    echo -e "${GREEN}✅ API opérationnelle${NC}"
    echo -e "${BLUE}📊 Statut:${NC} $HEALTH"
else
    echo -e "${RED}❌ L'API ne répond pas${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}┌────────────────────────────────────┐${NC}"
echo -e "${GREEN}│${NC}    🎉 Déploiement réussi !          ${GREEN}│${NC}"
echo -e "${GREEN}└────────────────────────────────────┘${NC}"
echo ""
echo -e "${BLUE}📌 Accès:${NC}"
echo -e "   • Frontend: ${GREEN}http://localhost:5173${NC}"
echo -e "   • API: ${GREEN}http://localhost:3000/api${NC}"
echo -e "   • Health: ${GREEN}http://localhost:3000/health${NC}"
echo -e "   • WebSocket: ${GREEN}ws://localhost:3000${NC}"
echo ""
echo -e "${YELLOW}📝 Logs:${NC} pm2 logs servicall (si PM2) ou pnpm run pm2:logs"
echo ""
[CONTINUÉ DANS LE PROCHAIN MESSAGE]

Ui
Je termine avec les derniers fichiers essentiels :
