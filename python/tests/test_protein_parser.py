"""Parser tests. They use a tiny real fragment (first 30 residues of AF-P01012-F1)."""
import numpy as np
import pytest
from conftest import FIXTURES

from common import validate_accession
from protein_parser import analyse_structure, ca_trace

MINI = FIXTURES / "mini.pdb"


def test_parses_valid_structure():
    info = analyse_structure(MINI)
    assert len(info["chains"]) == 1
    assert info["chains"][0]["residueCount"] == 30
    assert info["residueCount"] == 30
    assert info["chains"][0]["sequence"].startswith("MGSIGAASMEFCFDVFKELK")


def test_missing_file_raises():
    with pytest.raises(FileNotFoundError):
        analyse_structure(FIXTURES / "does_not_exist.pdb")


def test_coordinates_are_nonempty_and_consistent():
    coords, plddt = ca_trace(MINI)
    assert coords.shape == (30, 3)
    assert plddt.shape == (30,)
    assert np.all((plddt >= 0) & (plddt <= 100))
    # Neighbouring C-alpha atoms are about 3.8 angstroms apart in any protein.
    steps = np.linalg.norm(np.diff(coords, axis=0), axis=1)
    assert np.all((steps > 3.5) & (steps < 4.1))


def test_plddt_band_fractions_sum_to_one():
    bands = analyse_structure(MINI)["plddt"]["fractionByBand"]
    assert sum(bands.values()) == pytest.approx(1.0, abs=0.01)


def test_accession_validation():
    assert validate_accession(" p01012 ") == "P01012"
    with pytest.raises(ValueError):
        validate_accession("not-an-id")
