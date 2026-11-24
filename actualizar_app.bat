@echo off
chcp 65001 >nul
setlocal EnableExtensions

cd /d "%~dp0"
title Actualizar - Biblioteca de Algoritmos Nutricionales

set "NO_PAUSE=0"
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"

echo ============================================================
echo   Actualizar Biblioteca de Algoritmos desde GitHub
echo ============================================================
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Git no está instalado o no está en el PATH.
    goto :fail
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no está instalado o no está en el PATH.
    goto :fail
)

if not exist ".git" (
    echo [ERROR] Esta carpeta no está conectada a un repositorio Git.
    goto :fail
)

echo [1/4] Verificando cambios locales y conectando con GitHub...
set "STASHED=0"
for /f "delims=" %%S in ('git status --porcelain') do set "STASHED=1"

if "%STASHED%"=="1" (
    echo       Se detectaron cambios locales sin guardar. Creando respaldo temporal...
    git stash push --include-untracked -m "Respaldo automatico actualizar_app.bat"
    if errorlevel 1 (
        echo [ERROR] No se pudieron respaldar los cambios locales.
        goto :fail
    )
)

set "CURRENT_BRANCH="
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /i not "%CURRENT_BRANCH%"=="main" (
    echo       Cambiando a la rama main...
    git checkout main
    if errorlevel 1 goto :fail
)

echo [2/4] Descargando últimos cambios desde GitHub (rama main)...
git fetch origin main
if errorlevel 1 (
    echo [ERROR] No se pudo conectar con GitHub. Verifica tu conexión a internet.
    if "%STASHED%"=="1" git stash pop >nul 2>&1
    goto :fail
)

git pull --ff-only origin main
if errorlevel 1 (
    echo       Intentando integración automática...
    git pull origin main
    if errorlevel 1 (
        echo [ERROR] No se pudieron integrar los cambios automáticamente.
        if "%STASHED%"=="1" (
            echo         Tus cambios locales quedaron respaldados en git stash.
        )
        goto :fail
    )
)

if "%STASHED%"=="1" (
    echo       Restaurando tus cambios locales...
    git stash pop
    if errorlevel 1 (
        echo [AVISO] Hubo conflictos al restaurar tus cambios locales. Revisa con "git status".
    )
)

echo.
echo [3/4] Instalando/actualizando dependencias...
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo       Reintentando instalación en modo compatible...
    call npm install --legacy-peer-deps --no-audit --no-fund
    if errorlevel 1 (
        echo [ERROR] Falló la instalación de dependencias.
        echo         Si la app está abierta, cierra su ventana e intenta de nuevo.
        goto :fail
    )
)

echo.
echo [4/4] Recompilando la aplicación...
call npm run build
if errorlevel 1 (
    echo [ERROR] Falló la compilación del proyecto.
    goto :fail
)

echo.
echo ============================================================
echo   ¡Actualización y compilación completadas con éxito!
echo ============================================================
git log -1 --format="Última versión: %%h - %%s (%%ci)"
echo.
echo Ya puedes abrir la aplicación con doble clic en abrir_app.bat
echo.
if "%NO_PAUSE%"=="0" pause
exit /b 0

:fail
echo.
echo La actualización no pudo completarse. Revisa el error anterior.
echo.
if "%NO_PAUSE%"=="0" pause
exit /b 1
