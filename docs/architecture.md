# Architecture

## Layers

- `python/` scientific pipeline. `common.py` (paths, validation), `protein_parser.py` (Biopython facts), plus one script per step.
- `data/proteins/<ID>/` inputs: `original/` (downloaded PDB + `source.json`), `processed/` (analysis), `content.json` (human text).
- `web/public/proteins.json` registry; `web/public/proteins/<ID>/` generated static assets.
- `web/src` viewer. Protein-agnostic.

## Web modules

| Module | Job |
|---|---|
| `proteins/ProteinRegistry.ts` | registry fetch, URL to id, friendly errors |
| `proteins/ProteinManager.ts` | load metadata + model for a registry entry |
| `viewer/ModelLoader.ts` | GLTFLoader, centre and scale to 1 unit (original asset untouched) |
| `viewer/ProteinViewer.ts` | renderer, lights, loop, auto-rotate, reset |
| `controls/DesktopControls.ts` | OrbitControls (no pan, distance limits), keyboard |
| `xr/XRManager.ts` | capability detection, single session, start/end |
| `xr/XRInteractions.ts` | controller grab, thumbstick scale, reset, exit |
| `ui/ViewerControls.ts` | all DOM UI, loading and error states |

Scene graph: `scene > anchor (XR placement/scale) > spin (user rotation) > model (normalisation)`. Each level has one job so interactive transforms never alter normalisation.

## Supplying a better GLB

Export from Blender/Mol* with Y-up and save as `web/public/proteins/<ID>/model.glb`. The loader recentres and rescales any size. Run `python python/validate_model.py --uniprot <ID>`.

## Adding a protein

See README. Only data and one registry entry change.

## Future scenes

Scenes should be configuration-driven (per-protein JSON) and reuse `ProteinViewer`. Scene 2 needs the original PDB/mmCIF for secondary structure; a GLB mesh does not contain atoms.
