@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"
title Biblioteca de Algoritmos Nutricionales

set "PORT=3000"
set "APP_URL=http://localhost:%PORT%"

echo ============================================================
echo   Biblioteca de Algoritmos de Tratamiento Médico Nutricional
echo ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no está instalado o no está en el PATH.
    echo Descarga e instala Node.js desde https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [1/2] Instalando dependencias...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo       Reintentando instalación en modo compatible...
        call npm install --legacy-peer-deps --no-audit --no-fund
        if errorlevel 1 (
            echo.
            echo [ERROR] Falló la instalación de dependencias.
            pause
            exit /b 1
        )
    )
)

if not exist "dist\index.html" (
    echo [2/2] Compilando la aplicación...
    call npm run build
    if errorlevel 1 (
        echo.
        echo [ERROR] Falló la compilación del proyecto.
        pause
        exit /b 1
    )
)

node -e "const http=require('http'),port=process.env.PORT||'3000';const req=http.get('http://127.0.0.1:'+port,res=>{process.exit(res.statusCode>=200&&res.statusCode<500?0:1);});req.on('error',()=>process.exit(1));req.setTimeout(1000,()=>{req.destroy();process.exit(1);});" >nul 2>&1
if not errorlevel 1 (
    echo La aplicación ya estaba ejecutándose en %APP_URL%
    echo Abriendo en el navegador...
    start "" "%APP_URL%"
    timeout /t 2 /nobreak >nul
    exit /b 0
)

if not exist ".env" (
    echo [Nota] No se encontró archivo .env con GEMINI_API_KEY.
    echo        Todas las funciones locales funcionan 100%% sin internet.
    echo        Para usar la generación/digitalización con IA, crea .env
    echo        basado en .env.example y agrega tu clave de Gemini.
    echo.
)

echo Iniciando servidor local en %APP_URL% ...
echo No cierres esta ventana mientras uses la aplicación.
echo Ciérrala cuando termines para detener el servidor.
echo.

set "NODE_ENV=production"
start "" /b node -e "const http=require('http'),{spawn}=require('child_process'),port=process.env.PORT||'3000',url='http://localhost:'+port,t0=Date.now();(function poll(){const r=http.get('http://127.0.0.1:'+port,()=>{spawn('cmd',['/c','start','',url],{stdio:'ignore',detached:true}).unref();process.exit(0);});r.on('error',()=>{if(Date.now()-t0>20000)process.exit(1);setTimeout(poll,250);});r.setTimeout(1000,()=>r.destroy());})();"

node server.ts
if errorlevel 1 (
    echo.
    echo [ERROR] El servidor se detuvo con un error.
    pause
    exit /b 1
)
