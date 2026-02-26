@echo off
REM ============================================================
REM CryptoTrack - Installation rapide Windows 11
REM ============================================================
REM Clic droit > Exécuter en tant qu'administrateur
REM ============================================================

echo.
echo ========================================================
echo   CryptoTrack - Installation Windows 11
echo ========================================================
echo.
echo Ce script va :
echo   1. Verifier Python, Node.js
echo   2. Creer la structure du projet
echo   3. Installer les dependances
echo   4. Creer les scripts de lancement
echo.
pause

REM Lancer PowerShell avec le script d'installation
powershell -ExecutionPolicy Bypass -File "%~dp0install_windows.ps1"

pause
