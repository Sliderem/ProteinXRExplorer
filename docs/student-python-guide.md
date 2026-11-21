# Student Python guide

Python does the science in this project. The website only displays what Python produces.
Run everything from the repository root with the virtual environment active
(`source .venv/bin/activate`, or `.venv\Scripts\Activate.ps1` on Windows).

## Exercise 1: Download a protein

```bash
python python/download_protein.py --uniprot P01012
```

A **UniProt accession** is a unique ID for a protein sequence (P01012 = chicken ovalbumin). The script asks the AlphaFold database which file exists, downloads it, checks that it parses, and writes `source.json` recording where it came from. Open `data/proteins/P01012/original/` to see the files. The `.pdb` file is plain text: each `ATOM` line is one atom with x, y, z coordinates in angstroms.

## Exercise 2: Analyse a structure

```python
# save as python/try_biopython.py, then run: python python/try_biopython.py
from common import find_structure_file, load_structure

structure = load_structure(find_structure_file("P01012"))
for chain in structure[0]:
    print("Chain", chain.id, "has", len(list(chain.get_residues())), "residues")
```

A **residue** is one amino acid in the chain. Then run `python python/analyse_protein.py --uniprot P01012` and read the pLDDT explanation: it is how confident AlphaFold is about positions, not how strong or heat-resistant the protein is.

## Exercise 3: Generate JSON

```bash
python python/generate_metadata.py --uniprot P01012
```

Open `web/public/proteins/P01012/metadata.json`. JSON is a text format that both Python (`json` module) and the browser understand. Python measured the residue count from the real file; nothing was typed by hand.

## Exercise 4: Change the description

Edit `"description"` in `data/proteins/P01012/content.json`, run `generate_metadata.py` again, and refresh the browser: the info panel text changes.

## Exercise 5: Prepare a second protein

Every script takes `--uniprot`. For another protein (for example lysozyme, P00698): create `data/proteins/P00698/content.json` (copy the P01012 one and edit it), run the download, analyse, build_glb and generate_metadata scripts with `--uniprot P00698`, then add one entry to `web/public/proteins.json`. Check it with `python python/validate_model.py --uniprot P00698`.
