@echo off
chcp 65001 >nul
set "TARGET=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MacTahmin.cmd"
> "%TARGET%" echo @echo off
>> "%TARGET%" echo start "Mac Tahmin" /min cmd /c ""%~dp0baslat.bat" /arka"
echo Tamam: bilgisayar acildiginda arac kucuk bir pencerede otomatik baslayacak.
echo Kaldirmak icin otomatik-baslat-kaldir.bat dosyasina cift tiklayin.
pause
