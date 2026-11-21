"""Read a protein structure and measure simple, verifiable facts about it.

Everything returned here comes straight from the parsed file. Nothing is guessed.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
from Bio.PDB.Polypeptide import is_aa
from Bio.SeqUtils import seq1

from common import load_structure

# AlphaFold stores its per-residue confidence (pLDDT, 0-100) in the B-factor column.
# pLDDT says how sure the AI is about the *position* of a residue in the predicted
# model. It is NOT a measure of how stable the protein is or how it reacts to heat.
PLDDT_BANDS = [
    ("veryHigh", 90.0, 100.1, "Very high (>90)"),
    ("confident", 70.0, 90.0, "Confident (70-90)"),
    ("low", 50.0, 70.0, "Low (50-70)"),
    ("veryLow", 0.0, 50.0, "Very low (<50)"),
]


def residues_of_chain(chain) -> list:
    """Standard amino-acid residues of a chain (water and ligands excluded)."""
    return [r for r in chain if is_aa(r, standard=True)]


def analyse_structure(path: Path) -> dict[str, Any]:
    """Return a dictionary of facts about the first model in a structure file."""
    structure = load_structure(path)
    model = structure[0]

    chains = []
    all_plddt: list[float] = []
    for chain in model:
        residues = residues_of_chain(chain)
        if not residues:
            continue
        sequence = "".join(seq1(r.get_resname()) for r in residues)
        plddt = [float(r["CA"].get_bfactor()) for r in residues if "CA" in r]
        all_plddt.extend(plddt)
        chains.append(
            {
                "id": chain.id,
                "residueCount": len(residues),
                "firstResidue": residues[0].id[1],
                "lastResidue": residues[-1].id[1],
                "sequence": sequence,
            }
        )

    coords = np.array([a.coord for a in model.get_atoms()], dtype=float)
    plddt_arr = np.array(all_plddt, dtype=float)
    bands = {}
    for key, lo, hi, _label in PLDDT_BANDS:
        bands[key] = round(float(np.mean((plddt_arr >= lo) & (plddt_arr < hi))), 3) if plddt_arr.size else None

    return {
        "file": Path(path).name,
        "chains": chains,
        "residueCount": sum(c["residueCount"] for c in chains),
        "atomCount": int(len(coords)),
        "coordinateRangeAngstrom": {
            axis: [round(float(coords[:, i].min()), 2), round(float(coords[:, i].max()), 2)]
            for i, axis in enumerate("xyz")
        },
        "maxDimensionAngstrom": round(float((coords.max(axis=0) - coords.min(axis=0)).max()), 1),
        "plddt": {
            "mean": round(float(plddt_arr.mean()), 2) if plddt_arr.size else None,
            "fractionByBand": bands,
        },
    }


def ca_trace(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """Return C-alpha coordinates (N,3) and their pLDDT (N,) for the first chain.

    The C-alpha atom is the central carbon of each amino acid; joining them
    gives the 'backbone trace' of the protein.
    """
    structure = load_structure(path)
    coords, plddt = [], []
    chain = next(c for c in structure[0] if residues_of_chain(c))
    for r in residues_of_chain(chain):
        if "CA" in r:
            coords.append(r["CA"].coord)
            plddt.append(r["CA"].get_bfactor())
    return np.array(coords, dtype=float), np.array(plddt, dtype=float)
