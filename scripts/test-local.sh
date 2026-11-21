#!/usr/bin/env bash
# Python tests + TypeScript check + production build.
set -euo pipefail
cd "$(dirname "$0")/.."
.venv/bin/python -m pytest python/tests
(cd web && npm run build)
