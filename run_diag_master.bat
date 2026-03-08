@echo off
title Diag Master - KIA NQ5 Launcher
color 0B
echo -------------------------------------------------------
echo   DEMARRAGE DU SYSTEME DE DIAGNOSTIC KIA (NQ5 2023)
echo -------------------------------------------------------

:: 1. Lancement du Serveur Collector (Le "Cerveau" Python)
echo [STEP 1] Activation du Cloud VSD et de l'agent Python...
cd /d "%~dp0server"
start /min cmd /k "python collector_server.py"
cd /d "%~dp0"

:: 2. Attente de la stabilisation du serveur
timeout /t 3 /nobreak > nul

:: 3. Lancement de l'interface React et ouverture du navigateur
echo [STEP 2] Lancement de l'interface Diag Master...
start cmd /c "npm run dev"

:: 4. Ouverture automatique de l'URL locale
timeout /t 5 /nobreak > nul
start http://localhost:5173

echo.
echo ✅ SYSTEME OPERATIONNEL !
echo Le scanner est pret pour le VIN : U5YPV81BANL058699
echo -------------------------------------------------------
pause


