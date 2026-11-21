"""Metadata, GLB and registry tests (offline)."""
import json

import pytest
from conftest import FIXTURES

from build_glb import build_model
from common import WEB_PUBLIC
from generate_metadata import build_metadata
from protein_parser import analyse_structure
from validate_model import inspect_glb

SOURCE = {
    "entryId": "AF-P01012-F1",
    "organism": "Gallus gallus",
    "entryPage": "https://alphafold.ebi.ac.uk/entry/P01012",
    "modelVersion": 6,
    "licence": "CC-BY 4.0",
}
CONTENT = {"name": "Ovalbumin", "description": "Test description."}


def test_metadata_matches_structure():
    analysis = analyse_structure(FIXTURES / "mini.pdb")
    meta = build_metadata("P01012", SOURCE, analysis, CONTENT)
    assert meta["id"] == "P01012"
    assert meta["structure"]["residueCount"] == 30
    assert meta["structure"]["chains"] == [{"id": "A", "residueCount": 30}]
    assert meta["structure"]["type"] == "predicted"
    assert "heating" in meta["structure"]["notice"]
    json.dumps(meta)  # must be JSON serialisable


def test_glb_is_built_and_valid(tmp_path):
    out = tmp_path / "model.glb"
    stats = build_model(FIXTURES / "mini.pdb", out, "test")
    info = inspect_glb(out)
    assert info["vertices"] == stats["vertices"] > 100
    assert 0.05 < info["maxExtent"] < 100


def test_invalid_glb_rejected(tmp_path):
    bad = tmp_path / "bad.glb"
    bad.write_bytes(b"nonsense" * 10)
    with pytest.raises(ValueError):
        inspect_glb(bad)


def test_registry_references_exist():
    registry = json.loads((WEB_PUBLIC / "proteins.json").read_text())
    ids = [p["id"] for p in registry["proteins"]]
    assert registry["defaultProtein"] in ids
    for p in registry["proteins"]:
        for key in ("model", "metadata"):
            assert (WEB_PUBLIC / p[key].lstrip("/")).is_file(), p[key]
        meta = json.loads((WEB_PUBLIC / p["metadata"].lstrip("/")).read_text())
        assert meta["id"] == p["id"]
        assert meta["structure"]["residueCount"] > 0
