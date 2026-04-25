#!/bin/sh
set -e

# chainlit-pilot plugin — start Chainlit if OPENAI_API_KEY is present
if [ -n "$OPENAI_API_KEY" ]; then
  export CHAINLIT_URL=http://localhost:8000
  echo "[Sgummalla Works] Starting Chainlit on :8000..."
  (cd /app/plugins/chainlit-pilot && chainlit run app.py --host 0.0.0.0 --port 8000 --root-path /chainlit-app) &
else
  echo "[Sgummalla Works] OPENAI_API_KEY not set — Chainlit disabled"
fi

exec tsx server/src/index.ts
