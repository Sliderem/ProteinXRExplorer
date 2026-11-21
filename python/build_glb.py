"""Build a GLB 3D model (backbone trace tube) from a downloaded protein structure.

Usage:
    python python/build_glb.py --uniprot P01012

What this makes
---------------
A smooth tube that follows the real C-alpha atoms (one per amino acid) of the
protein, from the N-terminus to the C-terminus. It is coloured by AlphaFold's
per-residue confidence (pLDDT) using the standard AlphaFold colours.

What this is NOT
----------------
It is not a full "cartoon" (helix ribbons / sheet arrows). Those need a
secondary-structure assignment tool such as Mol* or Blender + Molecular Nodes.
See docs/architecture.md ("Supplying a better GLB") - any GLB placed at
web/public/proteins/<ID>/model.glb replaces this one without code changes.

Units: 1 angstrom = 0.01 scene units, so the model is roughly 0.7 units wide.
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

import numpy as np

from common import find_structure_file, processed_dir, validate_accession, web_protein_dir
from protein_parser import ca_trace

ANGSTROM = 0.01  # scene units per angstrom
TUBE_RADIUS = 1.1  # angstroms
SIDES = 10
SUBDIVISIONS = 6  # spline points per residue

# Standard AlphaFold DB confidence colours.
PLDDT_COLOURS = [
    (90.0, (0x00, 0x53, 0xD6)),  # very high - dark blue
    (70.0, (0x65, 0xCB, 0xF3)),  # confident - light blue
    (50.0, (0xFF, 0xDB, 0x13)),  # low - yellow
    (0.0, (0xFF, 0x7D, 0x45)),  # very low - orange
]


def plddt_colour(value: float) -> np.ndarray:
    for threshold, rgb in PLDDT_COLOURS:
        if value >= threshold:
            return np.array(rgb, dtype=float) / 255.0
    return np.array(PLDDT_COLOURS[-1][1], dtype=float) / 255.0


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    """glTF vertex colours are linear; convert from the sRGB colours above."""
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def catmull_rom(points: np.ndarray, per_segment: int) -> tuple[np.ndarray, np.ndarray]:
    """Smooth curve through the points. Returns positions and the source residue index."""
    p = np.vstack([2 * points[0] - points[1], points, 2 * points[-1] - points[-2]])
    out, src = [], []
    t = np.linspace(0, 1, per_segment, endpoint=False)[:, None]
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        seg = 0.5 * (
            2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t**2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t**3
        )
        out.append(seg)
        src.extend([i - 1 if tt < 0.5 else i for tt in t[:, 0]])
    out.append(points[-1][None, :])
    src.append(len(points) - 1)
    return np.vstack(out), np.array(src)


def tube_mesh(path_pts: np.ndarray, colours: np.ndarray, radius: float, sides: int):
    """Sweep a circle along the path using parallel transport (no twisting)."""
    n = len(path_pts)
    tangents = np.gradient(path_pts, axis=0)
    tangents /= np.linalg.norm(tangents, axis=1)[:, None]

    ref = np.array([0.0, 0.0, 1.0])
    if abs(np.dot(ref, tangents[0])) > 0.9:
        ref = np.array([1.0, 0.0, 0.0])
    normal = np.cross(tangents[0], ref)
    normal /= np.linalg.norm(normal)

    angles = np.linspace(0, 2 * np.pi, sides, endpoint=False)
    positions, normals, cols = [], [], []
    for i in range(n):
        if i > 0:  # rotate the previous frame onto the new tangent
            normal = normal - np.dot(normal, tangents[i]) * tangents[i]
            normal /= np.linalg.norm(normal)
        binormal = np.cross(tangents[i], normal)
        for a in angles:
            direction = np.cos(a) * normal + np.sin(a) * binormal
            positions.append(path_pts[i] + radius * direction)
            normals.append(direction)
            cols.append(colours[i])

    idx = []
    for i in range(n - 1):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            c = (i + 1) * sides + j
            d = (i + 1) * sides + (j + 1) % sides
            idx += [a, c, b, b, c, d]

    # End caps so the tube is closed.
    for ring, flip in ((0, True), (n - 1, False)):
        centre = len(positions)
        positions.append(path_pts[ring])
        normals.append(-tangents[ring] if flip else tangents[ring])
        cols.append(colours[ring])
        for j in range(sides):
            a = ring * sides + j
            b = ring * sides + (j + 1) % sides
            idx += [centre, b, a] if flip else [centre, a, b]

    return (
        np.array(positions, dtype=np.float32),
        np.array(normals, dtype=np.float32),
        np.array(cols, dtype=np.float32),
        np.array(idx, dtype=np.uint32),
    )


def write_glb(path: Path, pos, nor, col, idx, name: str, extras: dict) -> None:
    """Write a minimal, valid binary glTF 2.0 file."""
    pos = pos.astype("<f4")
    nor = nor.astype("<f4")
    col = col.astype("<f4")
    idx = idx.astype("<u4")
    blobs = [pos.tobytes(), nor.tobytes(), col.tobytes(), idx.tobytes()]
    binary = b"".join(blobs)  # every blob is 4-byte aligned already
    offsets = np.cumsum([0] + [len(b) for b in blobs])

    gltf = {
        "asset": {"version": "2.0", "generator": "ProteinXRExplorer python/build_glb.py"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": name}],
        "meshes": [
            {
                "name": name,
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "COLOR_0": 2},
                        "indices": 3,
                        "material": 0,
                    }
                ],
            }
        ],
        "materials": [
            {
                "name": "backbone",
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1, 1, 1, 1],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.45,
                },
            }
        ],
        "accessors": [
            {
                "bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3",
                "min": pos.min(axis=0).tolist(), "max": pos.max(axis=0).tolist(),
            },
            {"bufferView": 1, "componentType": 5126, "count": len(nor), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(col), "type": "VEC3"},
            {"bufferView": 3, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
        ],
        "bufferViews": [
            {"buffer": 0, "byteOffset": int(offsets[i]), "byteLength": int(offsets[i + 1] - offsets[i]),
             "target": 34963 if i == 3 else 34962}
            for i in range(4)
        ],
        "buffers": [{"byteLength": len(binary)}],
    }
    gltf["asset"]["extras"] = extras

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * (-len(json_bytes) % 4)
    total = 12 + 8 + len(json_bytes) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes)
        f.write(struct.pack("<I4s", len(binary), b"BIN\0") + binary)


def build_model(structure_path: Path, out_path: Path, name: str) -> dict:
    coords, plddt = ca_trace(structure_path)
    if len(coords) < 4:
        raise ValueError("Need at least 4 residues to build a backbone tube.")
    coords = (coords - coords.mean(axis=0)) * ANGSTROM  # centre on the origin

    curve, src = catmull_rom(coords, SUBDIVISIONS)
    colours = srgb_to_linear(np.array([plddt_colour(plddt[s]) for s in src]))
    pos, nor, col, idx = tube_mesh(curve, colours, TUBE_RADIUS * ANGSTROM, SIDES)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    extras = {
        "representation": "backbone-trace-tube",
        "colouring": "AlphaFold pLDDT",
        "source": structure_path.name,
        "unitsPerAngstrom": ANGSTROM,
    }
    write_glb(out_path, pos, nor, col, idx, name, extras)
    return {"vertices": len(pos), "triangles": len(idx) // 3, "bytes": out_path.stat().st_size}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--uniprot", default="P01012")
    parser.add_argument("--force", action="store_true", help="Overwrite an existing model.glb")
    args = parser.parse_args()
    try:
        acc = validate_accession(args.uniprot)
        structure = find_structure_file(acc)
    except (ValueError, FileNotFoundError) as err:
        print(f"Error: {err}")
        return 1

    out = web_protein_dir(acc) / "model.glb"
    if out.exists() and not args.force:
        print(f"{out} already exists - not overwriting (use --force to rebuild).")
        return 0
    stats = build_model(structure, out, acc)
    processed_dir(acc).mkdir(parents=True, exist_ok=True)
    (processed_dir(acc) / "model_build.json").write_text(json.dumps(stats, indent=2) + "\n")
    print(f"Wrote {out}: {stats['vertices']} vertices, {stats['triangles']} triangles, {stats['bytes']//1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
