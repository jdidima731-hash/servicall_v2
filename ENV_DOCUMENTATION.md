# Documentation des Variables d'Environnement - Servicall

## Variables Obligatoires (CRITICAL)

### Sécurité
- **ENCRYPTION_KEY** : Clé de chiffrement AES-256-CBC (générer avec `openssl rand -base64 32`)
- **ENCRYPTION_SALT** : Salt pour chiffrement (générer avec `openssl rand -base64 32`)
- **SESSION_SECRET** : Secret pour les sessions (générer avec `openssl rand -base64 32`)
- **CSRF_SECRET** : Secret CSRF (générer avec `openssl rand -base64 32`)
- **MASTER_KEY** : Clé maître (générer avec `openssl rand -base64 32`)

### Base de Données
- **DATABASE_URL** : URL PostgreSQL (format: `postgresql://user:password@host:port/database`)
- **REDIS_URL** : URL Redis (format: `redis://host:port`)

### Serveur
- **PORT** : Port d'écoute (défaut: 3000)
- **NODE_ENV** : Environnement (development, staging, production)
- **BASE_PATH** : Chemin de base de l'app (défaut: /)

## Variables Optionnelles

### OpenAI
- **OPENAI_API_KEY** : Clé API OpenAI (pour IA)
- **OPENAI_ORG_ID** : ID organisation OpenAI

### Twilio
- **TWILIO_ACCOUNT_SID** : SID compte Twilio
- **TWILIO_AUTH_TOKEN** : Token d'authentification Twilio
- **TWILIO_FROM_NUMBER** : Numéro Twilio sortant
- **TWILIO_WEBHOOK_URL** : URL webhook Twilio

### Stripe
- **STRIPE_SECRET_KEY** : Clé secrète Stripe
- **STRIPE_PUBLISHABLE_KEY** : Clé publique Stripe
- **STRIPE_WEBHOOK_SECRET** : Secret webhook Stripe

### Email (Resend)
- **RESEND_API_KEY** : Clé API Resend
- **RESEND_FROM_EMAIL** : Email d'envoi Resend

### Google
- **GOOGLE_CLIENT_ID** : ID client Google OAuth
- **GOOGLE_CLIENT_SECRET** : Secret client Google OAuth
- **GOOGLE_CALLBACK_URL** : URL de callback OAuth

### Storage (S3)
- **AWS_REGION** : Région AWS
- **AWS_ACCESS_KEY_ID** : Clé d'accès AWS
- **AWS_SECRET_ACCESS_KEY** : Clé secrète AWS
- **S3_BUCKET** : Nom du bucket S3

### Monitoring (Sentry)
- **SENTRY_DSN** : DSN Sentry pour error tracking
- **SENTRY_ENVIRONMENT** : Environnement Sentry

### CORS
- **ALLOWED_ORIGINS** : Origines autorisées (séparées par virgules)

## Génération des Clés de Sécurité

```bash
# Générer une clé sécurisée
openssl rand -base64 32

# Générer 5 clés à la fois
for i in {1..5}; do echo "Clé $i: $(openssl rand -base64 32)"; done
```

## Configuration par Environnement

### Développement
```env
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=debug
```

### Production
```env
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://your-domain.com
LOG_LEVEL=info
```

## Validation

Le serveur valide automatiquement :
- ✅ Les clés de sécurité obligatoires
- ✅ La connexion à la base de données
- ✅ La connexion à Redis
- ✅ Les services externes (OpenAI, Twilio, etc.)

Si une variable obligatoire manque, le serveur refuse de démarrer avec un message d'erreur clair.

## Sécurité

**⚠️ IMPORTANT :**
- Ne jamais commiter les fichiers .env
- Utiliser des secrets management en production
- Régulièrement rotationner les clés
- Utiliser des valeurs différentes par environnement
