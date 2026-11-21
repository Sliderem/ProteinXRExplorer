#!/usr/bin/env bash
# Start the website. Use "https" for Meta Quest testing on your local network.
set -euo pipefail
cd "$(dirname "$0")/../web"
if [ "${1:-}" = "https" ]; then npm run dev:https; else npm run dev; fi
