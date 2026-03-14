# Servicall Final - TODO List

## Phase 1 : Corrections Critiques
- [x] Corriger navigation React (remplacer <a href="#"> par wouter Link dans Home.tsx et Contact.tsx)
- [x] Sécuriser eval() dans DialogueEngineService.ts avec ConditionEvaluator
- [x] Connecter SendEmailAction.ts à Resend provider
- [ ] Ajouter route /health avec checks DB/Redis/OpenAI/Twilio
- [ ] Ajouter middleware rate limit express-rate-limit

## Phase 2 : Amélioration Blueprint Editor
- [ ] Améliorer UI Blueprint Editor avec drag-drop nodes
- [ ] Ajouter sauvegarde JSON workflows
- [ ] Ajouter visualisation workflow graph

## Phase 3 : Logs et Monitoring
- [ ] Ajouter logs détaillés pour OpenAI calls
- [ ] Ajouter logs détaillés pour Twilio calls
- [ ] Ajouter logs détaillés pour workflow errors
- [ ] Intégrer avec système de monitoring existant

## Phase 4 : Retry et Queue
- [ ] Améliorer retry système pour SMS/Email/IA calls
- [ ] Intégrer BullMQ pour queue management
- [ ] Ajouter exponential backoff

## Phase 5 : IA Agent par Prospect
- [ ] Créer ProspectAgentService pour générer résumés d'appels
- [ ] Ajouter sentiment analysis après appels
- [ ] Calculer probabilité de vente
- [ ] Proposer prochaine action automatiquement
- [ ] Créer page UI pour afficher IA Agent insights

## Phase 6 : Pipeline CRM Kanban
- [ ] Créer composant Kanban board pour pipeline
- [ ] Ajouter colonnes : nouveau lead, contacté, intéressé, négociation, gagné, perdu
- [ ] Intégrer scoring IA pour priorité appels
- [ ] Ajouter prédiction vente

## Phase 7 : Call Center IA Automatique
- [ ] Créer AutoCallCenterService pour appels automatiques
- [ ] Intégrer qualification prospect automatique
- [ ] Enregistrer réponses dans CRM automatiquement
- [ ] Ajouter fallback humain

## Phase 8 : AI Campaign Manager
- [ ] Créer CampaignManagerService pour orchestrer SMS/Email/Appels
- [ ] Ajouter relance automatique
- [ ] Intégrer avec workflow engine

## Phase 9 : Email Sync IMAP
- [ ] Ajouter support Gmail/Outlook/Email pro
- [ ] Créer EmailSyncService avec imapflow
- [ ] Synchroniser emails vers CRM

## Phase 10 : Modules CRM Synchronisation
- [ ] Vérifier Contacts module
- [ ] Vérifier Companies module
- [ ] Vérifier Deals module
- [ ] Vérifier Activities module
- [ ] Synchroniser entre V3 et V5

## Phase 11 : Tests et Validation
- [ ] Écrire vitest pour ConditionEvaluator
- [ ] Écrire vitest pour ProspectAgentService
- [ ] Écrire vitest pour AutoCallCenterService
- [ ] Tester navigation React
- [ ] Tester intégration Resend

## Phase 12 : Finalisation
- [ ] Vérifier cohérence globale
- [ ] Tester tous les endpoints
- [ ] Générer archive ZIP finale

## Phase 3 : Configuration Email dans Marketplace
- [x] Créer table email_configurations dans Drizzle schema
- [x] Ajouter chiffrement des credentials (crypto)
- [x] Créer EmailConfigService pour gérer les configs
- [ ] Ajouter endpoints API pour CRUD email config
- [x] Créer composant EmailConfigCard pour Marketplace
- [x] Intégrer cartes email dans IntegrationMarketplace.tsx
- [x] Ajouter test de connexion pour chaque provider
- [x] Ajouter validation des credentials avant sauvegarde
- [x] Ajouter logs d'audit pour les changements de config
- [x] Créer modal de configuration pour chaque provider

## Phase 4 : Logs, Monitoring et Health Check
- [ ] Ajouter route /health avec checks DB/Redis/OpenAI/Twilio
- [ ] Ajouter middleware rate limit express-rate-limit
- [ ] Ajouter logs détaillés pour OpenAI calls
- [ ] Ajouter logs détaillés pour Twilio calls
- [ ] Ajouter logs détaillés pour workflow errors
- [ ] Intégrer avec système de monitoring existant

## Phase 5 : IA Agent par Prospect
- [ ] Créer ProspectAgentService
- [ ] Générer résumés d'appels automatiquement
- [ ] Ajouter sentiment analysis après appels
- [ ] Calculer probabilité de vente
- [ ] Proposer prochaine action automatiquement

## Phase 6 : Pipeline CRM Kanban
- [ ] Créer composant Kanban board
- [ ] Ajouter colonnes : nouveau lead, contacté, intéressé, négociation, gagné, perdu
- [ ] Intégrer scoring IA pour priorité appels
- [ ] Ajouter prédiction vente

## Phase 7 : Call Center IA Automatique
- [ ] Créer AutoCallCenterService
- [ ] Intégrer qualification prospect automatique
- [ ] Enregistrer réponses dans CRM automatiquement
- [ ] Ajouter fallback humain

## Phase 8 : AI Campaign Manager
- [ ] Créer CampaignManagerService
- [ ] Ajouter relance automatique
- [ ] Intégrer avec workflow engine

## Phase 9 : Email Sync IMAP
- [ ] Ajouter support Gmail/Outlook/Email pro
- [ ] Créer EmailSyncService avec imapflow
- [ ] Synchroniser emails vers CRM

## Phase 10 : Modules CRM Synchronisation
- [ ] Vérifier Contacts module
- [ ] Vérifier Companies module
- [ ] Vérifier Deals module
- [ ] Vérifier Activities module

## Phase 0 : Corrections Finales de Sécurité
- [x] Corriger liens cassés dans ComponentShowcase.tsx (page démo)
- [x] Vérifier absence d'eval() dangereux
- [x] Vérifier absence de new Function() dangereux
- [x] Vérifier Resend connecté dans SendEmailAction.ts
