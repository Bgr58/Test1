@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurun. & pause & exit /b)
echo Mac Tahmin araci baslatiliyor... Bu pencereyi KAPATMAYIN.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js
pause
