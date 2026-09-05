@echo off
title Adega Gestao & PDV Agil - Iniciando Sistema...
color 0E

echo ========================================================
echo   ADEGA GESTAO & PDV AGIL - SISTEMA DESKTOP
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Compilando modulos com esbuild...
call npx esbuild src/js/app.js --bundle --outfile=src/js/bundle.js

echo [2/2] Iniciando aplicativo Electron...
echo.
call npx electron .

if errorlevel 1 (
    echo.
    echo Ocorreu um erro ao iniciar. Pressione qualquer tecla para sair.
    pause >nul
)