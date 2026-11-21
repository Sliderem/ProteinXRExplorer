import { Box3, Group, Mesh, Object3D, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AppError } from '../proteins/ProteinRegistry';

export type ProgressCallback = (fraction: number | null) => void;

/** Size (scene units) of the longest side of a normalised model. */
export const NORMALISED_SIZE = 1;

/**
 * Load a GLB and wrap it in a "normalised" group: centred on the origin and
 * scaled so its longest side is NORMALISED_SIZE. The original asset is never
 * modified, and user rotation/scale is applied on groups *above* this one.
 */
export async function loadModel(url: string, onProgress: ProgressCallback): Promise<Group> {
  // Check first so a missing file gives a clear message (dev servers return HTML for unknown paths).
  let head: Response;
  try {
    head = await fetch(url, { method: 'HEAD' });
  } catch {
    throw new AppError('Network unavailable', 'Could not reach the server while loading the 3D model.');
  }
  const type = head.headers.get('content-type') ?? '';
  if (!head.ok || type.includes('text/html')) {
    throw new AppError(
      '3D model missing',
      `No model file was found at ${url}. Run the Python pipeline or supply a GLB (see README).`,
    );
  }

  const gltf = await new GLTFLoader().loadAsync(url, (e) => onProgress(e.lengthComputable ? e.loaded / e.total : null)).catch((err: unknown) => {
    throw new AppError('Could not read 3D model', `The file ${url} is not a valid GLB: ${err instanceof Error ? err.message : String(err)}`);
  });

  let meshes = 0;
  gltf.scene.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh) meshes++;
  });
  if (meshes === 0) throw new AppError('Empty 3D model', `The GLB at ${url} contains no geometry.`);

  return normalise(gltf.scene);
}

export function normalise(content: Object3D): Group {
  const box = new Box3().setFromObject(content);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const longest = Math.max(size.x, size.y, size.z);
  if (!isFinite(longest) || longest <= 0) throw new AppError('Invalid 3D model', 'The model has no measurable size.');

  const group = new Group();
  group.name = 'normalised-model';
  content.position.sub(centre); // centre the content inside the group
  group.add(content);
  group.scale.setScalar(NORMALISED_SIZE / longest); // uniform: molecular proportions preserved
  return group;
}
