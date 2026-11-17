@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kurun. & pause & exit /b)
if not exist "node_modules\playwright-core" (
  echo Ilk kurulum: arka plan video ureticisi kuruluyor, biraz bekleyin...
  call npm install --no-audit --no-fund
)
echo.
echo Mac Tahmin araci calisiyor. Bu pencereyi KAPATMAYIN (kucultebilirsiniz).
echo Otomatik kuyruk bu pencere acik oldugu surece islenir.
echo.
if /i not "%~1"=="/arka" start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server.js
pause
