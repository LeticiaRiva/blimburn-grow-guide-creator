@echo off
title Blimburn Grow Guide Creator
echo.
echo  ============================================
echo   BLIMBURN GROW GUIDE CREATOR — Iniciando...
echo  ============================================
echo.

:: Verificar que Node.js está instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Node.js no está instalado.
    echo  Descárgalo en: https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Arrancar el servidor en la misma ventana (background de consola)
echo  Iniciando servidor local en puerto 3015...
echo  (Permitiendo acceso desde otros dispositivos de la red)
start /b node "%~dp0server.js"

:: Esperar 3 segundos a que el servidor arranque de verdad
echo  Esperando a que el servidor este listo...
timeout /t 3 /nobreak >nul

:: Abrir el navegador en el host
echo  Abriendo navegador...
start "" "http://localhost:3015"

echo.
echo  ======================================================
echo   Servidor activo. LOGS EN TIEMPO REAL ABAJO:
echo  ======================================================
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.

:: Mantener la ventana abierta para ver los logs
:loop
timeout /t 10 /nobreak >nul
goto loop
