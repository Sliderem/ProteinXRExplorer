"""Shared helpers for the ProteinXRExplorer Python pipeline.

Every script uses the same folder layout so that a new protein only needs a
new UniProt accession (for example ``--uniprot P00698`` for lysozyme).
"""
from __future__ import annotations

import re
from pathlib import Path

from Bio.PDB import PDBParser
from Bio.PDB.Structure import Structure

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data" / "proteins"
WEB_PUBLIC = REPO_ROOT / "web" / "public"

# UniProt accession format (official regular expression from UniProt).
UNIPROT_RE = re.compile(
    r"^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$"
)


def validate_accession(accession: str) -> str:
    """Return the upper-cased accession or raise ValueError if malformed."""
    acc = accession.strip().upper()
    if not UNIPROT_RE.match(acc):
        raise ValueError(f"'{accession}' is not a valid UniProt accession.")
    return acc


def original_dir(accession: str) -> Path:
    return DATA_DIR / accession / "original"


def processed_dir(accession: str) -> Path:
    return DATA_DIR / accession / "processed"


def web_protein_dir(accession: str) -> Path:
    return WEB_PUBLIC / "proteins" / accession


def find_structure_file(accession: str) -> Path:
    """Find the downloaded PDB file for an accession (raises if missing)."""
    folder = original_dir(accession)
    matches = sorted(folder.glob("*.pdb"))
    if not matches:
        raise FileNotFoundError(
            f"No PDB file in {folder}. Run: python python/download_protein.py --uniprot {accession}"
        )
    return matches[0]


def load_structure(path: Path) -> Structure:
    """Parse a PDB file with Biopython."""
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Structure file not found: {path}")
    structure = PDBParser(QUIET=True).get_structure(path.stem, str(path))
    if len(list(structure.get_atoms())) == 0:
        raise ValueError(f"No atoms found in {path}")
    return structure
