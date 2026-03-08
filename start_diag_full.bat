@echo off
title DIAG MASTER - FULL ECOSYSTEM (KIA NQ5)
color 0B

echo ======================================================
echo   DEMARRAGE COMPLET DU SYSTEME DE DIAGNOSTIC
echo ======================================================

:: 1. Expert AutoWizard (Node.js - Port 8080)
echo [1/4] Demarrage de l'Expert AutoWizard (Solutions)...
start /min cmd /c "cd services/AutoWizardAPI && npm start"

:: 2. Collector Server (Python - Port 5000)
echo [2/4] Activation du Cloud VSD & Scraping...
start /min cmd /k "python server/collector_server.py"

:: 3. Kia Agent (Python - Port 5001 - Eviter conflit avec collector)
:: Note: On modifie le port dans kia_agent.py si necessaire
echo [3/4] Initialisation des interfaces ELM327 / J2534...
start /min cmd /k "python kia_agent.py"

:: 4. Attente de synchronisation
echo ... Synchronisation des bases de donnees ...
timeout /t 6 /nobreak > nul

:: 5. Interface React (Vite - Port 5173)
echo [4/4] Lancement de l'interface Diag Master...
start /min cmd /c "npm run dev"

:: 6. Ouverture automatique des outils de visualisation
echo ✅ Ouverture de votre espace de travail...
timeout /t 2 /nobreak > nul

:: Interface Principale
start http://localhost:5173

:: (Optionnel) Visualisation des donnees Cloud brutes
:: start http://localhost:5001/api/vsd/status

echo.
echo ------------------------------------------------------
echo   TOUT EST PRET POUR LE VIN : U5YPV81BANL058699
echo ------------------------------------------------------
echo.
echo Services actifs:
echo   - Interface React:      http://localhost:5173
echo   - Expert AutoWizard:    http://localhost:8080
echo   - Collector Server:     http://localhost:5000
echo   - Kia Agent (ELM/J2534): http://localhost:5000
echo.
pause
