@echo off
title Lancement Diag Master - KIA NQ5
echo ===========================================
echo   DEMARRAGE DE DIAG MASTER (MODE EXPERT)
echo ===========================================

:: 1. Lancement du Serveur Collector Python dans une nouvelle fenêtre
echo [1/2] Activation de l'Agent Python (Collector & Scraping)...
cd server
start cmd /k "python collector_server.py"
cd ..

:: 2. Attente de 2 secondes pour laisser le serveur démarrer
timeout /t 2 /nobreak > nul

:: 3. Lancement de l'interface React
echo [2/2] Lancement de l'interface graphique (Vite)...
start cmd /c "npm run dev"

echo.
echo ===========================================
echo ✅ TOUT EST PRET ! 
echo L'interface va s'ouvrir dans votre navigateur.
echo Gardez les fenetres noires ouvertes pendant le diagnostic.
echo ===========================================
echo.
pause

