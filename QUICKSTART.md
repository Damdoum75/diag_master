#  Quick Start - Diag Master Kia Sportage NQ5

##  Installation Rapide (5 minutes)

### Étape 1: Ouvrir PowerShell dans le dossier du projet

\\\powershell
cd F:\diag_master
\\\

### Étape 2: Installer les dépendances

\\\powershell
npm install
\\\

**Durée estimée**: 2-3 minutes (première installation)

### Étape 3: Démarrer le serveur de développement

\\\powershell
npm run dev
\\\

**Résultat attendu**:
\\\
  VITE v5.0.8  ready in 234 ms

    Local:   http://localhost:5173/
    press h to show help
\\\

### Étape 4: Ouvrir dans le navigateur

Cliquer sur le lien ou ouvrir manuellement:
\\\
http://localhost:5173
\\\

---

##  Utilisation Immédiate (Mode Simulateur)

### 1. Onglet **Connexion**
-  Interface: **ELM327** (par défaut)
-  Mode Simulateur: **ON** (par défaut)
- Cliquer: **Connecter**

### 2. Onglet **Scan**
- Cliquer: **Démarrer le scan**
- Attendre ~5 secondes

### 3. Onglet **Résultats**
- Voir les DTCs détectés:
  - **B100552**: Défaut Capteur Crash Front-Left (ACU)
  - **B16F187**: Défaut Moteur Actuateur Phare IFS Gauche (ILCU)
  - **U116000**: Perte Communication Module ACU (ADAS)
  - **C110216**: Tension Batterie 12V Hors Plage (ESC)
  - **C166987**: Timeout Communication CAN (ABS)

### 4. Onglet **IA**
- Voir l'analyse contextuelle
- Identifier les cascades:
  - B100552  U116000 (cascade ACU  ADAS)
  - C110216  B16F187 (cascade batterie  phares)

---

##  Configuration (Optionnel)

### Fichier .env.local

Déjà créé avec les valeurs par défaut:

\\\env
VITE_API_KEY=371ab4e03a5044b28b7557fc0700d5ae
VITE_BASE44_TOKEN=
VITE_J2534_BRIDGE_PORT=27015
VITE_USE_SIMULATOR=true
\\\

**Pour utiliser le matériel réel**:
1. Éditer \.env.local\
2. Changer \VITE_USE_SIMULATOR=false\
3. Connecter ELM327 ou J2534
4. Redémarrer le serveur

---

##  Défauts Simulés (Mode Simulateur)

| Code | Module | Titre | Sévérité |
|------|--------|-------|----------|
| B100552 | ACU | Défaut Capteur Crash Front-Left |  Critical |
| B16F187 | ILCU | Défaut Moteur Actuateur Phare IFS Gauche |  High |
| U116000 | ADAS | Perte Communication Module ACU |  Critical |
| C110216 | ESC | Tension Batterie 12V Hors Plage |  High |
| C166987 | ABS | Timeout Communication CAN |  Medium |

---

##  Commandes Utiles

\\\powershell
# Démarrer le dev server
npm run dev

# Build pour production
npm run build

# Prévisualiser le build
npm run preview

# Linter le code
npm run lint

# Installer une dépendance
npm install <package-name>

# Mettre à jour les dépendances
npm update
\\\

---

##  Dépannage

### Erreur: \"Port 5173 already in use\"

\\\powershell
# Trouver le processus utilisant le port
netstat -ano | findstr :5173

# Tuer le processus (remplacer PID)
taskkill /PID <PID> /F

# Ou utiliser un autre port
npm run dev -- --port 5174
\\\

### Erreur: \"Cannot find module '@base44/sdk'\"

\\\powershell
# Réinstaller les dépendances
rm -r node_modules
npm install
\\\

### Erreur: \"Web Serial API not supported\"

- Utiliser **Chrome** ou **Edge** (pas Firefox/Safari)
- Vérifier que le navigateur est à jour

### Erreur: \"Bridge J2534 not available\"

- Vérifier que j2534-bridge.exe est lancé
- Vérifier le port (par défaut 27015)
- Lancer en tant qu'administrateur

---

##  Documentation Complète

Voir **README.md** pour:
- Architecture détaillée
- Configuration avancée
- Utilisation du matériel réel
- Intégration Base44 API
- Développement personnalisé

---

##  Checklist de Démarrage

- [ ] Node.js 18+ installé (\
ode --version\)
- [ ] npm installé (\
pm --version\)
- [ ] Dépendances installées (\
pm install\)
- [ ] Serveur lancé (\
pm run dev\)
- [ ] Navigateur ouvert (http://localhost:5173)
- [ ] Mode Simulateur activé
- [ ] Connexion établie
- [ ] Scan lancé
- [ ] Résultats affichés
- [ ] Analyse IA visible

---

**Prêt à diagnostiquer! **
