# 🚗 Diag Master - Kia Sportage NQ5 Diagnostic Tool

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Status](https://img.shields.io/badge/status-Active-success)

Outil de diagnostic professionnel pour Kia Sportage NQ5 MHEV (2022+). Interface web moderne pour la lecture et l'effacement des codes défaut (DTC) via ELM327 ou J2534.

## ✨ Fonctionnalités

- **Scan Multi-Modules**: ACU, ILCU, ADAS, MHEV, ECM, ABS, BCM, TCU
- **Lecture Données Temps Réel**: Batterie 12V/48V, RPM, Température, Vitesse
- **IA Contextuelle**: Analyse intelligente des codes défaut avec suggestions
- **Cloud VSD**: Recherche mondiale de solutions techniques
- **Sauvegarde Locale**: Historique des diagnostics via API Rails
- **Mode Simulateur**: Test sans matériel

## 🛠️ Installation

```bash
# Cloner le projet
git clone https://github.com/Damdoum75/diag_master.git
cd diag_master

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

## 🚀 Lancement Rapide

### Option 1: Script batch (Windows)
```bash
start_diag_full.bat
```

### Option 2: Manuel
```bash
# Terminal 1 - Serveur Flask (KIA Agent)
python kia_agent.py

# Terminal 2 - Serveur Collector VSD
python server/collector_server.py

# Terminal 3 - Frontend React
npm run dev
```

## 📡 Architecture

| Service | Port | Description |
|---------|------|-------------|
| React Frontend | 5173 | Interface utilisateur |
| KIA Agent | 5000 | Diagnostic ECU |
| Collector VSD | 5000 | Base données cloud |
| Rails API | 3000 | Sauvegarde locale |

## 🔧 Configuration

Copier `.env.example` vers `.env.local` et configurer:

```env
VITE_API_URL=http://localhost:3000
VITE_KIA_AGENT=http://localhost:5000
```

## 🎮 Utilisation

1. Connecter l'adaptateur ELM327/J2534 au véhicule
2. Cliquer sur "Connexion" dans l'interface
3. Démarrer le scan diagnostique
4. Consulter les résultats et l'analyse IA

## ☁️ Cloud VSD

Le système de recherche mondiale permet de:
- Trouver des solutions techniques partagées par la communauté
- Contribuer anonymement à la base de données
- Bénéficier de l'intelligence collective des techniciens

## 🤝 Contribution

Les contributions sont les bienvenues! Veuillez lire `CONTRIBUTING.md` pour plus de détails.

## 📄 Licence

MIT License - Voir `LICENSE` pour plus d'informations.

---

## ☕ Soutenir Diag Master

Si cet outil vous est utile, vous pouvez soutenir le projet avec des **USDC** sur le réseau **Arbitrum** :

| Réseau | Devise | Adresse du Wallet |
| :--- | :--- | :--- |
| **Arbitrum One** | `USDC` | `0x5241ECc26C653cd1ee484D94bB83413d21796190` |

[![Donate USDC Arbitrum](https://img.shields.io/badge/Donate-USDC%20(Arbitrum)-2775C9?style=for-the-badge&logo=ethereum&logoColor=white)](https://arbiscan.io/address/0x5241ECc26C653cd1ee484D94bB83413d21796190)

---

Développé avec ❤️ pour la communauté Kia.
