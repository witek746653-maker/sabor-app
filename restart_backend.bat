@echo off
echo Останавливаю Flask сервер...
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *app.py*" 2>nul
timeout /t 1 >nul
echo Запускаю Flask сервер...
cd backend
start "" cmd /k "python app.py"
timeout /t 2 >nul
echo Сервер перезапущен!
pause
