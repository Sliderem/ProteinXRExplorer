"""Optional: export a Blender scene to GLB with the right settings.

Use this when you have a nicer ribbon/cartoon model (for example made with the
Molecular Nodes add-on from the same AlphaFold PDB file).

Run from the command line:
    blender --background your_scene.blend --python blender/export_glb.py -- web/public/proteins/P01012/model.glb

Blender is NOT required for the default pipeline (python/build_glb.py).
"""
import sys

import bpy  # only available inside Blender

output = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "model.glb"

bpy.ops.export_scene.gltf(
    filepath=output,
    export_format="GLB",
    export_apply=True,        # bake modifiers (Molecular Nodes uses geometry nodes)
    export_colors=True,       # keep vertex colours
    export_yup=True,          # three.js uses Y-up
    use_selection=False,
)
print(f"Exported {output}")
