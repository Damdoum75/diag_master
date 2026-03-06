# Diag Master - Kia Sportage NQ5 Diagnostic Tool

Outil de diagnostic complet pour Kia Sportage NQ5 (MHEV) avec support des défauts Front Radar et BSM.

##  Objectif

Diagnostiquer et analyser les défauts du système ADAS (Advanced Driver Assistance Systems) et du système de freinage (BSM) sur Kia Sportage NQ5, en particulier:

- **Front Radar**: Capteurs de choc avant (ACU)
- **BSM (Blind Spot Monitor)**: Système de détection d'angle mort
- **ADAS**: Systèmes d'aide à la conduite (FCW, AEB, LKA)
- **Phares Adaptatifs**: Système IFS (Intelligent Front-lighting System)

##  Architecture

### 1. **Dashboard** (src/pages/Dashboard.tsx)
- Vue d'ensemble du diagnostic
- Gestion des onglets (Connexion, Scan, Résultats, IA)
- Orchestration des services

### 2. **ConnectionPanel** (src/components/diag/ConnectionPanel.tsx)
- Sélection de l'interface (ELM327 ou J2534)
- Mode simulateur pour tests sans matériel
- Affichage des logs en temps réel
- Gestion de la connexion/déconnexion

### 3. **J2534Service** (src/services/J2534Service.ts)
- Communication via PassThru (norme SAE)
- Support des interfaces certifiées (Drew Technologies, Bosch, etc.)
- Protocole ISO 15765-4 CAN 11bit 500Kbps
- WebSocket bridge pour accès depuis navigateur

### 4. **ELM327Service** (src/services/ELM327Service.ts)
- Communication via adaptateur USB OBD-II
- Web Serial API (Chrome/Edge)
- Lecture des DTCs (Mode 03)
- Lecture des données en direct (PIDs)
- Effacement des codes (Mode 04)

### 5. **AIAnalysis** (src/components/diag/AIAnalysis.tsx)
- Analyse contextuelle des défauts
- Identification des cascades de défauts
- Corrélation entre modules
- Recommandations de diagnostic

### 6. **dtcDatabase** (src/components/diag/dtcDatabase.ts)
- Base de données complète des DTCs Kia NQ5
- Descriptions détaillées en français
- Causes possibles et solutions
- Corrélations entre défauts

### 7. **Base44Service** (src/services/base44Service.ts)
- Intégration avec l'API Base44
- Stockage des sessions de diagnostic
- Filtrage par VIN, module, DTC
- Historique des diagnostics

##  Installation

### Prérequis
- Node.js 18+
- npm ou yarn
- Chrome/Edge (pour Web Serial API)

### Étapes

1. **Cloner/Télécharger le projet**
   `ash
   cd F:\diag_master
   `

2. **Installer les dépendances**
   `ash
   npm install
   `

3. **Configurer les variables d'environnement**
   `ash
   cp .env.example .env.local
   # Éditer .env.local avec vos clés API
   `

4. **Démarrer le serveur de développement**
   `ash
   npm run dev
   `

5. **Ouvrir dans le navigateur**
   `
   http://localhost:5173
   `

##  Utilisation

### Mode Simulateur (Recommandé pour tests)

1. Ouvrir l'application
2. Onglet **Connexion**:
   - Sélectionner interface (ELM327 ou J2534)
   - Activer **Mode Simulateur** (ON)
   - Cliquer **Connecter**
3. Onglet **Scan**:
   - Cliquer **Démarrer le scan**
   - Attendre la fin du scan
4. Onglet **Résultats**:
   - Voir les DTCs détectés
   - Consulter les données en direct
5. Onglet **IA**:
   - Voir l'analyse contextuelle
   - Identifier les cascades de défauts

### Mode Réel (ELM327)

1. Connecter l'adaptateur ELM327 USB au PC
2. Connecter l'adaptateur OBD-II au véhicule
3. Désactiver **Mode Simulateur**
4. Sélectionner **ELM327**
5. Cliquer **Connecter**
6. Procéder au scan

### Mode Réel (J2534)

1. Installer le bridge J2534 local:
   `ash
   # Télécharger j2534-bridge.exe depuis le dépôt
   # Lancer en tant qu'administrateur
   j2534-bridge.exe
   `
2. Connecter l'interface PassThru au PC
3. Désactiver **Mode Simulateur**
4. Sélectionner **J2534**
5. Cliquer **Connecter**
6. Procéder au scan

##  Configuration

### .env.local

`env
# API Key Base44 (ne pas commiter en production)
VITE_API_KEY=371ab4e03a5044b28b7557fc0700d5ae

# Token d'authentification Base44
VITE_BASE44_TOKEN=your_token_here

# Port du bridge J2534
VITE_J2534_BRIDGE_PORT=27015

# Utiliser le simulateur par défaut
VITE_USE_SIMULATOR=true
`

##  Défauts Kia Sportage NQ5 Supportés

### ACU (Airbag Control Unit)
- **B100552**: Défaut Capteur Crash Front-Left
  - Cause: Connecteur J10 démonté, câble sectionné
  - Impact: Désactivation SRS et ADAS
  - Solution: Inspecter connecteur et faisceau

### ILCU (Intelligent Lighting Control)
- **B16F187**: Défaut Moteur Actuateur Phare IFS Gauche
  - Cause: Sous-tension 12V, moteur bloqué
  - Impact: Phare figé, non-conformité CT
  - Solution: Vérifier tension 12V et actuateur

### ESC (Electronic Stability Control)
- **C110216**: Tension Batterie 12V Hors Plage
  - Cause: Batterie dégradée, alternateur défaillant
  - Impact: Défauts en cascade, ESP erratique
  - Solution: Mesurer tension, tester batterie

### ADAS (Advanced Driver Assistance Systems)
- **U116000**: Perte Communication Module ACU
  - Cause: Défaut B100552, bus CAN endommagé
  - Impact: AEB, FCW, LKA désactivés
  - Solution: Résoudre B100552, vérifier CAN

### ABS (Anti-lock Braking System)
- **C166987**: Timeout Communication CAN
  - Cause: Baudrate ELM327 incorrect, perte CAN
  - Impact: Fausse lecture, ABS non fonctionnel
  - Solution: Reconfigurer ELM327 (115200 bps)

##  Analyse IA

L'IA identifie automatiquement:

1. **Cascades de défauts**: B100552  U116000
2. **Corrélations**: C110216  B16F187
3. **Faux positifs**: C166987 (timeout ELM327)
4. **Priorités de diagnostic**: Ordre de résolution

##  API Base44

### Endpoints

`javascript
// Lire les sessions de diagnostic
GET /api/apps/69a82acd6ad3c4743cafe6c4/entities/DiagnosticSession

// Créer une session
POST /api/apps/69a82acd6ad3c4743cafe6c4/entities/DiagnosticSession

// Mettre à jour une session
PUT /api/apps/69a82acd6ad3c4743cafe6c4/entities/DiagnosticSession/{id}

// Filtrer par VIN
GET /api/apps/69a82acd6ad3c4743cafe6c4/entities/DiagnosticSession?vin=KMHEC4A46EU123456
`

### Champs filtrables

- session_date
- vehicle
- vin
- protocol
- baudrate
- modules_scanned
- dtcs_found
- live_data_snapshots
- cleared_codes
- technician_notes
- report_generated

##  Développement

### Structure du projet

`
F:\diag_master\
 src/
    api/
       base44Client.ts          # Client Base44
    components/
       diag/
          AIAnalysis.tsx       # Analyse IA
          ConnectionPanel.tsx  # Panneau connexion
          DiagnosticsTable.tsx # Tableau résultats
          dtcDatabase.ts       # Base DTCs
       ui/                      # Composants shadcn/ui
    pages/
       Dashboard.tsx            # Page principale
    services/
       ELM327Service.ts         # Service ELM327
       J2534Service.ts          # Service J2534
       base44Service.ts         # Service Base44
    lib/
       app-params.ts            # Configuration
       utils.ts                 # Utilitaires
    App.tsx                      # Composant racine
    main.tsx                     # Point d'entrée
    index.css                    # Styles Tailwind
 entities/
    DiagnisticSession.json       # Schéma entité
 index.html                       # HTML racine
 vite.config.js                   # Config Vite
 tailwind.config.js               # Config Tailwind
 tsconfig.json                    # Config TypeScript
 package.json                     # Dépendances
 .env.local                       # Variables d'env
`

### Scripts npm

`ash
npm run dev      # Démarrer dev server
npm run build    # Build production
npm run preview  # Prévisualiser build
npm run lint     # Linter le code
`

##  Sécurité

- **Ne pas commiter** .env.local avec les clés API
- Utiliser des variables d'environnement en production
- Implémenter un proxy backend pour les appels API sensibles
- Valider les entrées utilisateur côté serveur

##  Licence

Propriétaire - Diagnostic Kia Sportage NQ5

##  Support

Pour les questions ou problèmes:
1. Consulter la documentation Base44
2. Vérifier les logs en temps réel
3. Tester en mode simulateur d'abord
4. Vérifier la configuration ELM327/J2534

---

**Version**: 1.0.0  
**Dernière mise à jour**: 2024
