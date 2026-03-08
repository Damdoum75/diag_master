@echo off
title DIAG MASTER - FULL AUTOMATION
color 0B

echo ======================================================
echo   DEMARRAGE AUTOMATIQUE DES SERVICES DIAGNOSTIC
echo ======================================================

:: Vérification si le dossier AutoWizardAPI existe
if not exist "..\AutoWizardAPI\AutoWizardAPI\AutoWizardAPI.csproj" (
    echo [AVERTISSEMENT] AutoWizardAPI non trouve dans ..\AutoWizardAPI
    echo Veuillez cloner: git clone https://github.com/xaviarboykins/AutoWizardAPI.git
    echo.
)

:: 1. Lancement de l'Expert AutoWizard (.NET - Port 8080)
echo [1/4] Demarrage de l'Expert AutoWizard (.NET)...
if exist "..\AutoWizardAPI\AutoWizardAPI\bin\Debug\net7.0\AutoWizardAPI.exe" (
    start /min cmd /c "cd /d ..\AutoWizardAPI\AutoWizardAPI\bin\Debug\net7.0 && AutoWizardAPI.exe"
) else (
    echo [INFO] AutoWizardAPI non compile. utilisez: dotnet build dans le dossier AutoWizardAPI
)

:: 2. Lancement du Serveur Kia Agent (Python - Port 5000)
echo [2/4] Activation du Cerveau Python (ELM/J2534)...
start /min cmd /k "python kia_agent.py"

:: 3. Lancement du Collector Server Python (Backup - Port 5000)
echo [3/4] Activation du Collector Server...
cd server
start /min cmd /k "python collector_server.py"
cd ..

:: 4. Attente de la stabilisation des serveurs
timeout /t 3 /nobreak > nul

:: 5. Lancement de l'Interface React (Vite - Port 5173)
echo [4/4] Lancement de l'interface Diag Master...
start /min cmd /c "npm run dev"

:: 6. Ouverture automatique des URLs dans le navigateur
echo.
echo [AUTO] Ouverture des consoles de controle...
timeout /t 2 /nobreak > nul

:: Ouvre l'interface principale
start http://localhost:5173

:: Ouvre l'API Expert pour verification (si demarree)
start http://localhost:8080/swagger/index.html

echo.
echo ------------------------------------------------------
echo   SYSTEME OPERATIONNEL - TOUTES LES URLS OUVERTES
echo ------------------------------------------------------
echo.
echo Services actifs:
echo   - Interface React:     http://localhost:5173
echo   - Expert AutoWizard:   http://localhost:8080 (si compile)
echo   - Kia Agent Python:    http://localhost:5000
echo   - Collector Server:     http://localhost:5000
echo.
echo Cliquez sur une touche pour fermer ce terminal...
pause > nul

