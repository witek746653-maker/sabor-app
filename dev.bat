@echo off
echo.
echo == Starting Sabor App (Concurrent Mode) ==
echo.

npx concurrently --kill-others --names "BACKEND,FRONTEND" --prefix-colors "yellow,cyan" ^
  "powershell -ExecutionPolicy Bypass -File .\tools\start_backend_full.ps1" ^
  "cd frontend && npm start"
