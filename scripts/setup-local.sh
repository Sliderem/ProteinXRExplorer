#!/usr/bin/env bash
# Create the Python virtual environment and install Python + web dependencies.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
(cd web && npm install)
echo "Setup complete. Next: scripts/prepare-protein.sh P01012"
