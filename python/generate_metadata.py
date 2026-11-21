"""Generate web/public/proteins/<ID>/metadata.json for the website.

Usage:
    python python/generate_metadata.py --uniprot P01012

Inputs
    data/proteins/<ID>/original/source.json   (written by download_protein.py)
    data/proteins/<ID>/original/*.pdb         (parsed with Biopython)
    data/proteins/<ID>/content.json           (human-written name + description)

Edit content.json to change the text shown on the website, then run this again.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from common import DATA_DIR, find_structure_file, original_dir, validate_accession, web_protein_dir
from protein_parser import analyse_structure

PLDDT_NOTE = (
    "pLDDT is AlphaFold's confidence in the predicted position of each residue. "
    "It is not a measure of stability or of how the protein reacts to heat."
)
PREDICTION_NOTICE = (
    "This is a computer-predicted structure from AlphaFold DB. "
    "It is not an experimentally measured structure, and it does not show the protein after heating."
)
LEGEND = [
    {"label": "Very high (>90)", "colour": "#0053D6"},
    {"label": "Confident (70-90)", "colour": "#65CBF3"},
    {"label": "Low (50-70)", "colour": "#FFDB13"},
    {"label": "Very low (<50)", "colour": "#FF7D45"},
]


def build_metadata(accession: str, source: dict[str, Any], analysis: dict[str, Any], content: dict[str, Any]) -> dict[str, Any]:
    """Combine verified facts (source + analysis) with human-written content."""
    return {
        "id": accession,
        "name": content["name"],
        "organism": source["organism"],
        "description": content["description"],
        "source": {
            "database": "AlphaFold DB",
            "accession": source["entryId"],
            "uniprot": accession,
            "modelVersion": source.get("modelVersion"),
            "url": source["entryPage"],
            "uniprotUrl": f"https://www.uniprot.org/uniprotkb/{accession}/entry",
            "licence": source.get("licence"),
            "attribution": "Jumper et al. 2021; Varadi et al. 2024 (AlphaFold Protein Structure Database)",
        },
        "structure": {
            "type": "predicted",
            "notice": PREDICTION_NOTICE,
            "chains": [{"id": c["id"], "residueCount": c["residueCount"]} for c in analysis["chains"]],
            "residueCount": analysis["residueCount"],
            "atomCount": analysis["atomCount"],
            "maxDimensionAngstrom": analysis["maxDimensionAngstrom"],
            "meanPlddt": analysis["plddt"]["mean"],
        },
        "model": {
            "representation": "Backbone trace (C-alpha tube)",
            "colouring": content.get("display", {}).get("colouring", "AlphaFold confidence (pLDDT)"),
            "legend": LEGEND,
            "legendNote": PLDDT_NOTE,
        },
        # Display settings are kept apart from the science above.
        "display": content.get("display", {}),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--uniprot", default="P01012")
    args = parser.parse_args()
    try:
        acc = validate_accession(args.uniprot)
        structure = find_structure_file(acc)
        source = json.loads((original_dir(acc) / "source.json").read_text(encoding="utf-8"))
        content = json.loads((DATA_DIR / acc / "content.json").read_text(encoding="utf-8"))
        analysis = analyse_structure(structure)
    except (ValueError, FileNotFoundError, json.JSONDecodeError) as err:
        print(f"Error: {err}")
        return 1

    meta = build_metadata(acc, source, analysis, content)
    out = web_protein_dir(acc) / "metadata.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {out}")
    print(f"  {meta['name']} - {meta['organism']} - {meta['structure']['residueCount']} residues")
    return 0


if __name__ == "__main__":
    sys.exit(main())
