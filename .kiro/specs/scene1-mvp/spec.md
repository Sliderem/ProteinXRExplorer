# Scene 1 MVP: Meet the Molecule

## Requirements
- Python pipeline downloads, analyses and validates an AlphaFold structure and writes JSON metadata and a GLB.
- Protein-agnostic registry (`proteins.json`) and viewer; `/` and `/protein/<ID>` routes.
- Desktop: rotate, zoom, auto-rotate with pause, reset, fullscreen, loading and error states, science panel.
- WebXR: VR and MR entry, grab, thumbstick scale, reset, exit.
- No invented science: predicted structure is labelled; no heat simulation.

## Design
See `docs/architecture.md`.

## Tasks
- [x] Python pipeline and tests
- [x] Registry, loader, viewer, desktop controls, UI
- [x] WebXR manager and interactions (hardware verification pending)
- [x] Docs, scripts, Vercel rewrite
- [ ] Verify on a Meta Quest 3 (`docs/quest-testing.md`)
- [ ] Replace the backbone tube with a cartoon GLB
