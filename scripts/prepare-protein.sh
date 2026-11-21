#!/usr/bin/env bash
# Run the whole Python pipeline for one UniProt accession (default P01012).
set -euo pipefail
cd "$(dirname "$0")/.."
ACC="${1:-P01012}"
PY=.venv/bin/python
$PY python/download_protein.py --uniprot "$ACC"
$PY python/analyse_protein.py --uniprot "$ACC"
$PY python/build_glb.py --uniprot "$ACC"      # skipped if a model.glb already exists
$PY python/generate_metadata.py --uniprot "$ACC"
$PY python/validate_model.py --uniprot "$ACC"
