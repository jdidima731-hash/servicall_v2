# Audit Corrections - TODO

## Phase 1 : Backend Corrections

### 1.1 Validation des Requêtes Entrantes
- [ ] Créer middleware de validation Zod pour POST/PUT
- [ ] Valider tous les endpoints API
- [ ] Ajouter messages d'erreur clairs

### 1.2 Error Handler Global
- [ ] Créer middleware error handler centralisé
- [ ] Capturer toutes les erreurs serveur
- [ ] Logger les erreurs avec contexte

### 1.3 CORS Sécurisé
- [ ] Restreindre les domaines autorisés
- [ ] Configurer par environnement (dev/prod)
- [ ] Ajouter credentials si nécessaire

### 1.4 Dépendances Inutiles
- [ ] Supprimer cookie-parser
- [ ] Nettoyer package.json
- [ ] Vérifier les imports inutilisés

## Phase 2 : Backend Complétude

### 2.1 Dossiers Vides
- [ ] Remplir middlewares/ avec middlewares réels
- [ ] Remplir lib/ avec utilitaires
- [ ] Organiser le code

### 2.2 Configuration Build
- [ ] Optimiser build.ts
- [ ] Inclure UNIQUEMENT les packages utilisés
- [ ] Réduire la taille du bundle

### 2.3 Documentation Backend
- [ ] Documenter les endpoints
- [ ] Ajouter exemples de requêtes
- [ ] Corriger les erreurs (healthz vs health)

## Phase 3 : Frontend Corrections

### 3.1 Variables d'Environnement
- [ ] Définir PORT et BASE_PATH
- [ ] Créer .env.example
- [ ] Documenter les variables requises

### 3.2 Configuration TypeScript
- [ ] Corriger tsconfig.json
- [ ] Ajouter références manquantes
- [ ] Vérifier les imports

### 3.3 Documentation Frontend
- [ ] Corriger replit.md (/health → /healthz)
- [ ] Ajouter guide de démarrage
- [ ] Documenter la structure

## Phase 4 : Frontend Complétude

### 4.1 Structure Librairie
- [ ] Organiser les modules clairement
- [ ] Documenter les dépendances
- [ ] Ajouter barrel exports

### 4.2 Cohérence des Imports
- [ ] Vérifier tous les imports
- [ ] Corriger les chemins relatifs
- [ ] Ajouter alias si nécessaire

## Phase 5 : Tests Intégration

### 5.1 Backend Tests
- [ ] Tester validation des requêtes
- [ ] Tester error handler
- [ ] Tester CORS

### 5.2 Frontend Tests
- [ ] Tester les pages
- [ ] Tester les composants
- [ ] Tester les routes

## Phase 6 : Tests en Ligne

### 6.1 Accès Public
- [ ] Exposer le lien
- [ ] Vérifier l'accessibilité

### 6.2 Tests Fonctionnels
- [ ] Tester toutes les pages
- [ ] Tester tous les boutons
- [ ] Tester les formulaires

### 6.3 Tests de Sécurité
- [ ] Vérifier eval() absent
- [ ] Vérifier email provider
- [ ] Vérifier CORS

## Phase 7 : Livraison

### 7.1 Rapport Final
- [ ] Générer rapport d'audit
- [ ] Lister tous les problèmes corrigés
- [ ] Score final

### 7.2 Archive Production
- [ ] Créer archive ZIP
- [ ] Inclure documentation
- [ ] Prêt pour déploiement
