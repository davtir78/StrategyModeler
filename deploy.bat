@echo off
REM ============================================================
REM  Strategy Modeler - deploy to Firebase Hosting
REM  Serves the project root directly (firebase.json -> "public": ".")
REM  No need to move files into a public/ folder.
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo === Strategy Modeler : Firebase Hosting deploy ===
echo Project root: %CD%
echo.

REM --- Ensure the Firebase CLI is available -----------------
where firebase >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Firebase CLI not found on PATH.
  echo         Install it once with:  npm install -g firebase-tools
  echo         Then re-run this script.
  exit /b 1
)

REM --- Ensure you are logged in -----------------------------
call firebase login:list >nul 2>nul
if errorlevel 1 (
  echo You are not logged in. Opening the Firebase login flow...
  call firebase login
  if errorlevel 1 (
    echo [ERROR] Firebase login failed.
    exit /b 1
  )
)

REM --- Deploy hosting only ----------------------------------
echo Deploying hosting...
call firebase deploy --only hosting %*
if errorlevel 1 (
  echo.
  echo [ERROR] Deploy failed. Common fixes:
  echo   - Wrong project id: run  firebase use --add  and pick your StrategyModeler project
  echo   - Not initialised:   the .firebaserc alias is "strategymodeler" - edit it if yours differs
  exit /b 1
)

echo.
echo === Deploy complete ===
endlocal
