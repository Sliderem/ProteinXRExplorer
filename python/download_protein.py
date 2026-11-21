"""Download a predicted protein structure from the AlphaFold Protein Structure Database.

Usage:
    python python/download_protein.py --uniprot P01012

We ask the official AlphaFold API which model files currently exist instead of
guessing a file name, because AlphaFold model versions change over time.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

from common import find_structure_file, load_structure, original_dir, validate_accession

API_URL = "https://alphafold.ebi.ac.uk/api/prediction/{acc}"


def http_get(url: str, timeout: int = 60) -> bytes:
    """Fetch a URL and return the raw bytes, with a readable error on failure."""
    req = urllib.request.Request(url, headers={"User-Agent": "ProteinXRExplorer/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read()
    except urllib.error.HTTPError as err:
        raise RuntimeError(f"Server returned HTTP {err.code} for {url}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"Network problem reaching {url}: {err.reason}") from err


def pick_model(entries: list[dict], accession: str) -> dict:
    """Choose the AlphaFold entry that belongs to the requested UniProt accession."""
    for entry in entries:
        if entry.get("uniprotAccession") == accession:
            return entry
    raise ValueError(f"AlphaFold API returned no model for {accession}.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--uniprot", default="P01012", help="UniProt accession (default: P01012)")
    parser.add_argument("--force", action="store_true", help="Download again even if files exist")
    args = parser.parse_args()

    try:
        acc = validate_accession(args.uniprot)
    except ValueError as err:
        print(f"Error: {err}")
        return 2

    out = original_dir(acc)
    out.mkdir(parents=True, exist_ok=True)

    if not args.force and list(out.glob("*.pdb")) and (out / "source.json").exists():
        print(f"Already downloaded in {out} (use --force to refresh).")
        return 0

    try:
        print(f"Asking AlphaFold DB about {acc} ...")
        entries = json.loads(http_get(API_URL.format(acc=acc)))
        entry = pick_model(entries, acc)
        pdb_url = entry["pdbUrl"]
        print(f"  Model: {entry['entryId']} (version {entry.get('latestVersion')})")
        print(f"  Downloading {pdb_url}")
        pdb_bytes = http_get(pdb_url)
    except (RuntimeError, ValueError, KeyError, json.JSONDecodeError) as err:
        print(f"Error: {err}")
        return 1

    pdb_path = out / f"{entry['entryId']}.pdb"
    pdb_path.write_bytes(pdb_bytes)

    # Validate: it must parse and contain atoms.
    try:
        structure = load_structure(pdb_path)
    except Exception as err:  # noqa: BLE001 - show any parser problem clearly
        pdb_path.unlink(missing_ok=True)
        print(f"Error: downloaded file is not a valid PDB structure: {err}")
        return 1

    n_atoms = len(list(structure.get_atoms()))
    source = {
        "database": "AlphaFold Protein Structure Database",
        "uniprot": acc,
        "entryId": entry["entryId"],
        "modelVersion": entry.get("latestVersion"),
        "modelCreatedDate": entry.get("modelCreatedDate"),
        "organism": entry.get("organismScientificName"),
        "gene": entry.get("gene"),
        "proteinDescription": entry.get("uniprotDescription"),
        "globalPlddt": entry.get("globalMetricValue"),
        "pdbUrl": pdb_url,
        "cifUrl": entry.get("cifUrl"),
        "apiUrl": API_URL.format(acc=acc),
        "entryPage": f"https://alphafold.ebi.ac.uk/entry/{acc}",
        "licence": "CC-BY 4.0 (AlphaFold DB)",
        "downloadedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "file": pdb_path.name,
    }
    (out / "source.json").write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {pdb_path.relative_to(out.parent.parent.parent)} ({n_atoms} atoms)")
    print(f"Saved source information to source.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
