@echo off
REM Launch backend and static frontend for demo
cd /d %~dp0
echo Starting backend (uvicorn) in new window...
start "Backend" cmd /k "backend\.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
timeout /t 2 >nul
echo Starting static server on port 3000...
start "Frontend" cmd /k "python -m http.server 3000 --directory frontend"
timeout /t 2 >nul
echo Opening browser to frontend...
start "" "http://127.0.0.1:3000/index.html"
exit /b 0
