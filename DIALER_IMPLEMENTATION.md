# Servicall V3.3 - Système de Dialer Prédictif

## Vue d'ensemble

Ce document décrit l'implémentation complète du système de dialer prédictif pour Servicall V3.3. Le système utilise une architecture basée sur les queues Bull/Redis pour gérer les appels téléphoniques via l'API Twilio.

## Architecture

### Composants principaux

1. **DialerEngine** (`/server/services/dialer/dialer-engine.ts`)
   - Moteur central de gestion des appels
   - Utilise Bull pour la gestion des queues
   - Gère le cycle de vie complet des campagnes

2. **TwilioService** (`/server/services/twilio/twilio-service.ts`)
   - Service d'intégration Twilio
   - Effectue les appels téléphoniques
   - Gère les SMS et les statuts d'appels

3. **Routes de Campagnes** (`/server/routes/campaigns.ts`)
   - API REST pour la gestion des campagnes
   - Endpoints pour démarrer/arrêter les campagnes
   - Récupération des statuts et des prospects

4. **Interface Utilisateur** (`/client/src/pages/CampaignsPage.tsx`)
   - Dashboard de gestion des campagnes
   - Monitoring en temps réel
   - Contrôles de campagne

### Schéma de base de données

#### Table `campaigns`
```sql
- id: INTEGER PRIMARY KEY
- tenant_id: INTEGER (FK)
- name: VARCHAR(255)
- type: ENUM (outbound_predictive_dialer, outbound_power_dialer, etc.)
- status: ENUM (draft, active, paused, completed, archived)
- dialer_settings: JSON (pacing_ratio, max_attempts, retry_delay_s)
- schedule: JSON (start_time, end_time, weekdays_only)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### Table `campaign_prospects`
```sql
- id: INTEGER PRIMARY KEY
- campaign_id: INTEGER (FK)
- prospect_id: INTEGER (FK)
- status: ENUM (pending, dialing, completed, failed, scheduled)
- call_attempts: INTEGER
- last_attempt_at: TIMESTAMP
- scheduled_at: TIMESTAMP
- completed_at: TIMESTAMP
- notes: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

## Configuration

### Variables d'environnement requises

```env
# Redis
REDIS_URL=redis://localhost:6379
DISABLE_REDIS=false

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+1234567890
TWILIO_WEBHOOK_URL=https://your-domain.com/api/twilio/webhook
```

### Installation des dépendances

Les dépendances suivantes sont déjà incluses dans `package.json`:
- `bullmq` - Gestion des queues
- `ioredis` - Client Redis
- `twilio` - SDK Twilio

## Flux de fonctionnement

### 1. Création d'une campagne

```bash
POST /api/campaigns
{
  "name": "Campagne Q1 2024",
  "description": "Description optionnelle",
  "status": "draft"
}
```

### 2. Ajout de prospects

```bash
POST /api/campaigns/:id/prospects
{
  "prospectIds": [1, 2, 3, 4, 5]
}
```

### 3. Démarrage de la campagne

```bash
POST /api/campaigns/:id/start
```

Le moteur de dialer:
1. Récupère tous les prospects de la campagne
2. Ajoute les appels à la queue Bull
3. Traite les appels selon le pacing ratio configuré
4. Effectue les appels via Twilio
5. Gère les retries en cas d'échec

### 4. Monitoring

```bash
GET /api/campaigns/:id/status
GET /api/campaigns/:id/prospects
```

### 5. Arrêt de la campagne

```bash
POST /api/campaigns/:id/stop
```

## Configuration du dialer

Lors du démarrage d'une campagne, les paramètres suivants peuvent être configurés:

```typescript
interface DialerConfig {
  pacingRatio: number;        // Nombre d'appels par agent
  maxAttempts: number;        // Nombre maximum de tentatives
  retryDelaySeconds: number;  // Délai entre les retries (en secondes)
  maxConcurrentCalls: number; // Nombre maximum d'appels simultanés
}
```

## Statuts des prospects

- **pending**: En attente d'être appelé
- **dialing**: Appel en cours
- **completed**: Appel terminé avec succès
- **failed**: Appel échoué après tous les retries
- **scheduled**: Rappel programmé

## Gestion des erreurs

### Retry automatique

Si un appel échoue:
1. Le système attend `retryDelaySeconds` secondes
2. Relance l'appel (jusqu'à `maxAttempts` fois)
3. Si tous les retries échouent, marque le prospect comme "failed"

### Logging

Tous les événements sont loggés:
- Démarrage/arrêt de campagne
- Appels initiés
- Appels complétés/échoués
- Erreurs et exceptions

## Intégration Twilio

### Configuration du webhook

Twilio doit être configuré pour envoyer les statuts d'appels à:
```
POST https://your-domain.com/api/twilio/webhook
```

### Statuts d'appels supportés

- `queued` - En attente
- `ringing` - Sonnerie
- `in-progress` - En cours
- `completed` - Terminé
- `failed` - Échoué
- `busy` - Occupé
- `no-answer` - Pas de réponse

## Performance et scalabilité

### Limites par défaut

- **Concurrence**: 5 appels simultanés
- **Tentatives**: 3 tentatives par prospect
- **Délai de retry**: 5 minutes

### Optimisation

Pour augmenter la performance:
1. Augmenter `maxConcurrentCalls` (attention aux limites Twilio)
2. Utiliser un cluster Redis pour la haute disponibilité
3. Distribuer le traitement sur plusieurs workers

## Dépannage

### Appels non lancés

1. Vérifier que Redis est actif: `redis-cli ping`
2. Vérifier les logs du serveur pour les erreurs
3. Vérifier les credentials Twilio
4. Vérifier que les prospects ont des numéros de téléphone valides

### Queue bloquée

```bash
# Vérifier la taille de la queue
redis-cli LLEN bull:predictive-dialer:wait

# Nettoyer la queue (attention!)
redis-cli DEL bull:predictive-dialer:*
```

### Statut de campagne incorrect

Vérifier la base de données:
```sql
SELECT * FROM campaigns WHERE id = ?;
SELECT * FROM campaign_prospects WHERE campaign_id = ? AND status != 'completed';
```

## API Endpoints

### Campagnes

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/campaigns` | Lister toutes les campagnes |
| GET | `/api/campaigns/:id` | Récupérer une campagne |
| POST | `/api/campaigns` | Créer une campagne |
| PUT | `/api/campaigns/:id` | Mettre à jour une campagne |
| DELETE | `/api/campaigns/:id` | Supprimer une campagne |
| POST | `/api/campaigns/:id/start` | Démarrer une campagne |
| POST | `/api/campaigns/:id/stop` | Arrêter une campagne |
| GET | `/api/campaigns/:id/status` | Obtenir le statut |
| GET | `/api/campaigns/:id/prospects` | Lister les prospects |
| POST | `/api/campaigns/:id/prospects` | Ajouter des prospects |

## Déploiement

### Prérequis

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Compte Twilio actif

### Étapes de déploiement

1. **Cloner le repository**
   ```bash
   git clone <repository-url>
   cd servicall
   ```

2. **Installer les dépendances**
   ```bash
   pnpm install
   ```

3. **Configurer l'environnement**
   ```bash
   cp .env.example .env
   # Éditer .env avec vos valeurs
   ```

4. **Initialiser la base de données**
   ```bash
   npm run db:setup
   ```

5. **Construire le projet**
   ```bash
   npm run build
   ```

6. **Démarrer le serveur**
   ```bash
   npm start
   ```

## Monitoring et observabilité

### Métriques clés

- Nombre de campagnes actives
- Nombre d'appels en queue
- Taux de succès/échec
- Temps moyen d'appel
- Nombre de retries

### Logs

Les logs sont disponibles via:
- Console (développement)
- Fichiers de log (production)
- Sentry (si configuré)

## Support et maintenance

Pour les problèmes ou questions:
1. Vérifier les logs du serveur
2. Consulter la documentation Twilio
3. Vérifier l'état de Redis
4. Vérifier la connectivité de la base de données

## Roadmap future

- [ ] Support des campagnes SMS
- [ ] Support des campagnes email
- [ ] Gestion des agents en temps réel
- [ ] Analytics avancées
- [ ] Intégration CRM
- [ ] Support des IVR
- [ ] Enregistrement des appels
