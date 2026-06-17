@echo off
chcp 65001 >nul
cd /d "%~dp0infrastructure\docker"
echo Lancement du stack Docker...
docker compose up -d --build
echo.
echo Attente du demarrage de l'API...
timeout /t 5 /nobreak >nul
echo.
echo Ouverture du dashboard dans le navigateur...
start "" "%~dp0dashboard\index.html"
echo.
echo Dashboard ouvert. Backend API: http://localhost:8780/docs
pause
