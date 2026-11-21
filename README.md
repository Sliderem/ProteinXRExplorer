# Protein XR Explorer

Explore real protein structures in 3D, virtual reality (VR) and mixed reality (MR). The first protein is **ovalbumin** (chicken egg white, UniProt P01012), shown from the AlphaFold predicted structure AF-P01012-F1. The viewer is generic: other proteins are added through a registry, not code changes.

**Version 0.1.0-alpha.1.** Scene 1 ("Meet the Molecule") is implemented. Scenes 2 and 3 are roadmap only.

## Architecture

```
Python (local, offline-capable)            Static website (no backend)
download_protein.py  -> AlphaFold PDB      web/public/proteins.json   registry
analyse_protein.py   -> Biopython facts    web/public/proteins/<ID>/model.glb + metadata.json
build_glb.py         -> model.glb          Three.js viewer + WebXR (TypeScript, Vite)
generate_metadata.py -> metadata.json
```

Python produces static files; the browser only loads them. Nothing needs a server, so Vercel hosting later is straightforward.

## Quick start (Linux/macOS)

```bash
scripts/setup-local.sh            # venv + pip + npm install
scripts/prepare-protein.sh P01012 # download, analyse, build model, metadata, validate
scripts/start-local.sh            # http://localhost:5173
scripts/test-local.sh             # pytest + tsc + production build
```

Manual / Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python python/download_protein.py --uniprot P01012
python python/analyse_protein.py --uniprot P01012
python python/build_glb.py --uniprot P01012
python python/generate_metadata.py --uniprot P01012
python python/validate_model.py --uniprot P01012
python -m pytest python/tests
cd web; npm install; npm run dev
```

Web scripts: `npm run dev`, `npm run dev:https` (Quest testing), `npm run build`, `npm run preview`, `npm run typecheck`.

URLs: `/` loads the default protein, `/protein/P01012` loads it directly (refresh works).

## The 3D model (important)

Blender was not available and no GLB was supplied, so `python/build_glb.py` creates `model.glb` from the real C-alpha coordinates in the AlphaFold file: a smooth **backbone-trace tube**, coloured by AlphaFold confidence (pLDDT). It is accurate to the coordinates but it is **not a full ribbon/cartoon** (no helix or sheet shapes).

To use a better model (for example a cartoon from Mol* or Blender with Molecular Nodes), export a GLB and save it as `web/public/proteins/P01012/model.glb`. `blender/export_glb.py` has the export settings. `build_glb.py` will not overwrite an existing file unless you pass `--force`. Update `metadata.json`'s `model` section (via `data/proteins/<ID>/content.json` / `generate_metadata.py`) if the colouring or representation differs.

If the GLB is missing, the app shows a clear "3D model missing" message.

## Adding another protein

1. `scripts/prepare-protein.sh <UNIPROT>` (or run the Python commands with `--uniprot`).
2. Create `data/proteins/<UNIPROT>/content.json` first (copy the P01012 one: name, description). `generate_metadata.py` needs it.
3. Add one entry to `web/public/proteins.json`.
4. `python python/validate_model.py --uniprot <UNIPROT>`.

No viewer or XR code changes.

## Status

| Feature | Status |
|---|---|
| Python download / analysis / metadata / GLB / validation | Implemented, run against real data |
| pytest (9 tests, offline fixtures) | Passing |
| TypeScript check + production build | Passing |
| Desktop viewer (rotate, zoom, auto-rotate, reset, fullscreen, loading/errors, `/protein/ID`) | Implemented; page render and unknown-ID error checked with headless Chrome. Mouse/touch/fullscreen interactions not exercised by an automated test |
| WebXR VR / MR sessions, controller grab, thumbstick scale, reset, exit | Implemented, **unverified on a real headset** (see `docs/quest-testing.md`) |
| Model quality | Backbone tube, not a cartoon (see above) |
| Vercel | Prepared (`web/vercel.json`), not deployed |

## Limitations

- Predicted structure only; it does not show ovalbumin after heating, and no temperature or starch effect is simulated.
- Model is a backbone trace, not a cartoon.
- XR placement is a fixed position in front of the start point; no table detection, anchors or hand tracking; one hand grabs at a time.
- English only.

## Roadmap (not implemented)

- Scene 2, Discover Protein Architecture: helix/sheet/loop highlighting and ribbon/surface/atomic views (needs the original PDB/mmCIF, not just the GLB), annotations in French and English.
- Scene 3, Heat and Denaturation: any unfolding animation must be labelled conceptual unless backed by validated simulation; students' experimental CSV data processed with Python and plotted as real measurements.

More: `docs/architecture.md`, `docs/scientific-sources.md`, `docs/student-python-guide.md`, `docs/quest-testing.md`, `docs/deployment.md`.
