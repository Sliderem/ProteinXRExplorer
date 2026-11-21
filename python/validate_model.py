"""Check that a protein's web assets are present and consistent.

Usage:
    python python/validate_model.py --uniprot P01012

Checks: registry entry, metadata.json, model.glb (valid header, has geometry,
usable size) and that the metadata matches the structure file.
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

from common import WEB_PUBLIC, validate_accession, web_protein_dir


def inspect_glb(path: Path) -> dict:
    """Read a GLB header and JSON chunk; raise ValueError if it is not usable."""
    data = Path(path).read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise ValueError("not a GLB file (missing 'glTF' header)")
    version, length = struct.unpack("<II", data[4:12])
    if version != 2 or length != len(data):
        raise ValueError("unsupported glTF version or truncated file")
    json_len, chunk = struct.unpack("<I4s", data[12:20])
    if chunk != b"JSON":
        raise ValueError("first GLB chunk is not JSON")
    gltf = json.loads(data[20 : 20 + json_len])
    meshes = gltf.get("meshes", [])
    if not meshes:
        raise ValueError("GLB contains no meshes")
    pos_acc = gltf["accessors"][meshes[0]["primitives"][0]["attributes"]["POSITION"]]
    lo, hi = pos_acc["min"], pos_acc["max"]
    size = max(h - l for l, h in zip(lo, hi))
    return {"meshes": len(meshes), "vertices": pos_acc["count"], "maxExtent": size, "bytes": len(data)}


def validate(accession: str) -> list[str]:
    """Return a list of problems (empty list means everything is fine)."""
    problems: list[str] = []
    folder = web_protein_dir(accession)

    registry_path = WEB_PUBLIC / "proteins.json"
    try:
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        entry = next((p for p in registry["proteins"] if p["id"] == accession), None)
        if entry is None:
            problems.append(f"{accession} is missing from proteins.json")
        else:
            for key in ("model", "metadata"):
                if not (WEB_PUBLIC / entry[key].lstrip("/")).is_file():
                    problems.append(f"registry '{key}' path does not exist: {entry[key]}")
    except (OSError, json.JSONDecodeError, KeyError) as err:
        problems.append(f"cannot read proteins.json: {err}")

    try:
        meta = json.loads((folder / "metadata.json").read_text(encoding="utf-8"))
        if meta.get("id") != accession:
            problems.append("metadata id does not match accession")
        if not meta.get("structure", {}).get("residueCount"):
            problems.append("metadata has no residueCount")
    except (OSError, json.JSONDecodeError) as err:
        problems.append(f"metadata.json problem: {err}")

    try:
        info = inspect_glb(folder / "model.glb")
        if not 0.05 <= info["maxExtent"] <= 100:
            problems.append(f"model extent {info['maxExtent']:.3f} is outside the usable range")
    except (OSError, ValueError, KeyError) as err:
        problems.append(f"model.glb problem: {err}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--uniprot", default="P01012")
    args = parser.parse_args()
    try:
        acc = validate_accession(args.uniprot)
    except ValueError as err:
        print(f"Error: {err}")
        return 2
    problems = validate(acc)
    if problems:
        print(f"{acc}: {len(problems)} problem(s)")
        for p in problems:
            print(f"  - {p}")
        return 1
    info = inspect_glb(web_protein_dir(acc) / "model.glb")
    print(f"{acc}: OK  ({info['vertices']} vertices, {info['bytes']//1024} KB, extent {info['maxExtent']:.2f})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
