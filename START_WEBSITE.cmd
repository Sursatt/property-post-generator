@echo off
cd /d "%~dp0"

set "NODE_EXE=C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "NEXT_BIN=%~dp0node_modules\next\dist\bin\next"

if not exist "%NODE_EXE%" (
  echo Cannot find bundled Node.js:
  echo %NODE_EXE%
  echo.
  pause
  exit /b 1
)

if not exist "%NEXT_BIN%" (
  echo Cannot find Next.js in node_modules.
  echo Please make sure dependencies are installed.
  echo.
  pause
  exit /b 1
)

set "USERPROFILE=%~dp0"
set "HOME=%~dp0"
set "APPDATA=%~dp0.appdata\roaming"
set "LOCALAPPDATA=%~dp0.appdata\local"
set "PNPM_HOME=%~dp0.pnpm-home"
set "XDG_CACHE_HOME=%~dp0.cache"
set "npm_config_store_dir=%~dp0.pnpm-store"
set "npm_config_cache=%~dp0.npm-cache"
set "PATH=C:\Users\Lenovo\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Windows\System32;C:\Windows;C:\Windows\System32\WindowsPowerShell\v1.0"

echo Chiang Mai rental website
echo.
echo Preview URL:
echo http://127.0.0.1:3000
echo.
echo Keep this window open while previewing the website.
echo Press Ctrl+C to stop the server.
echo.

start "" "http://127.0.0.1:3000"
"%NODE_EXE%" "%NEXT_BIN%" dev --hostname 127.0.0.1 --port 3000

pause
