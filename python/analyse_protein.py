"""Print a readable scientific summary of a downloaded protein structure.

Usage:
    python python/analyse_protein.py --uniprot P01012
"""
from __future__ import annotations

import argparse
import json
import sys

from common import find_structure_file, processed_dir, validate_accession
from protein_parser import PLDDT_BANDS, analyse_structure


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--uniprot", default="P01012")
    args = parser.parse_args()

    try:
        acc = validate_accession(args.uniprot)
        path = find_structure_file(acc)
        info = analyse_structure(path)
    except (ValueError, FileNotFoundError) as err:
        print(f"Error: {err}")
        return 1

    print(f"Protein {acc}   file: {info['file']}")
    print(f"Chains: {len(info['chains'])}")
    for c in info["chains"]:
        print(f"  Chain {c['id']}: {c['residueCount']} residues "
              f"(numbered {c['firstResidue']}-{c['lastResidue']})")
        print(f"  Sequence start: {c['sequence'][:60]}...")
    print(f"Total residues: {info['residueCount']}   atoms: {info['atomCount']}")
    print("Coordinate ranges (angstroms, 1 A = 0.1 nm):")
    for axis, (lo, hi) in info["coordinateRangeAngstrom"].items():
        print(f"  {axis}: {lo} to {hi}")
    print(f"Longest dimension of the bounding box: {info['maxDimensionAngstrom']} A")

    print("\nAlphaFold confidence (pLDDT)")
    print("  pLDDT is a score from 0 to 100 for how confident AlphaFold is about the")
    print("  predicted POSITION of each residue. It does NOT measure how stable the")
    print("  protein is, and says nothing about how it reacts to heat or starch.")
    print(f"  Mean pLDDT: {info['plddt']['mean']}")
    for key, _lo, _hi, label in PLDDT_BANDS:
        frac = info["plddt"]["fractionByBand"][key]
        print(f"  {label:<20} {frac * 100:5.1f}% of residues")

    out = processed_dir(acc)
    out.mkdir(parents=True, exist_ok=True)
    (out / "analysis.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    print(f"\nSaved analysis to {out / 'analysis.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
