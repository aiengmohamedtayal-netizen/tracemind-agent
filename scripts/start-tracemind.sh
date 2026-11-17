#!/usr/bin/env bash
# TraceMind — Linux/macOS startup script
# Equivalent of scripts/start-tracemind.ps1 for Unix systems.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

PYTHON_CMD="${PYTHON_CMD:-python3}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

echo "==> TraceMind startup (Linux/macOS)"
echo "    Python: $PYTHON_CMD | Backend: :$BACKEND_PORT | Frontend: :$FRONTEND_PORT"

# --- Backend ---
echo ""
echo "[1/6] Creating Python virtual environment..."
if [ ! -d ".venv" ]; then
  "$PYTHON_CMD" -m venv .venv
fi
source .venv/bin/activate

echo "[2/6] Installing backend dependencies..."
pip install -q -r backend/requirements.txt

echo "[3/6] Copying .env if missing..."
[ -f backend/.env ] || cp backend/.env.example backend/.env

echo "[4/6] Running database migrations..."
PYTHONPATH=backend python -m alembic -c backend/alembic.ini upgrade head

echo "[5/6] Starting FastAPI backend on port $BACKEND_PORT..."
PYTHONPATH=backend uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

# Health check
echo "    Waiting for backend..."
for i in $(seq 1 15); do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/api/health" > /dev/null 2>&1; then
    echo "    Backend is up!"
    break
  fi
  sleep 1
done

# --- Frontend ---
echo "[6/6] Starting Vite frontend on port $FRONTEND_PORT..."
npm install --silent
npm run dev -- --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

echo ""
echo "==> TraceMind is running:"
echo "    Frontend: http://localhost:$FRONTEND_PORT"
echo "    Backend:  http://localhost:$BACKEND_PORT"
echo "    API Docs: http://localhost:$BACKEND_PORT/docs"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" INT TERM
wait
