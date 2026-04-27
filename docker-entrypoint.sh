#!/bin/sh
set -e

# Start Chainlit on internal port 8000 (not exposed outside the container)
cd /app/copilot
CHAINLIT_AUTH_SECRET="$COPILOT_AUTH_SECRET" chainlit run app.py --root-path /copilot --port 8000 --headless &

# Start Express on port 3000 (the only exposed port)
cd /app
exec tsx server/src/index.ts
