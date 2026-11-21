import {
  Color,
  DirectionalLight,
  Euler,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { AppError } from '../proteins/ProteinRegistry';

const BACKGROUND = new Color(0x0b1220); // dark navy
const AUTO_ROTATE_SPEED = 0.25; // radians per second (about one turn per 25 s)

/** Where the molecule floats in XR (metres, local-floor space): in front of the visitor at chest/eye level. */
export const XR_POSITION = new Vector3(0, 1.3, -1.0);
export const XR_DEFAULT_SCALE = 0.45; // normalised model is 1 unit wide -> 45 cm in XR

/**
 * Scene graph (each level has ONE job, so transforms never fight each other):
 *
 *   scene
 *    └─ anchor   XR placement + XR scaling (identity on desktop)
 *        └─ spin     user rotation / auto-rotation
 *            └─ model   normalisation (centre + fit), set once by ModelLoader
 */
export class ProteinViewer {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly anchor = new Group();
  readonly spin = new Group();

  autoRotate = true;
  /** Set true by anything that is currently manipulating the model (mouse drag, VR grab). */
  interacting = false;

  private model: Group | null = null;
  private initialSpin = new Quaternion();
  private frameCallbacks: ((dt: number, frame?: XRFrame) => void)[] = [];
  private changeListeners: (() => void)[] = [];
  private lastTime = 0;
  private resizeObserver: ResizeObserver;

  constructor(private readonly container: HTMLElement) {
    try {
      this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      throw new AppError('3D graphics unavailable', 'Your browser could not start WebGL. Try a different browser or enable hardware acceleration.');
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); // CSS gradient shows through on desktop
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', '3D view of the protein. Drag to rotate, scroll to zoom.');

    this.camera = new PerspectiveCamera(45, 1, 0.05, 100);
    this.scene.add(this.anchor);
    this.anchor.add(this.spin);
    this.addLights();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.resetCamera();

    this.renderer.setAnimationLoop((time, frame) => this.tick(time, frame));
  }

  private addLights(): void {
    this.scene.add(new HemisphereLight(0xcfe3ff, 0x1a2238, 1.3));
    const key = new DirectionalLight(0xffffff, 2.2);
    key.position.set(2, 3, 4);
    const rim = new DirectionalLight(0x6fa8ff, 1.0);
    rim.position.set(-3, -1, -2);
    this.scene.add(key, rim);
  }

  /** Show a protein model (replaces any previous one and frees its GPU memory). */
  setModel(model: Group, initialRotationDegrees: number[] = [0, 0, 0]): void {
    if (this.model) {
      this.spin.remove(this.model);
      disposeObject(this.model);
    }
    this.model = model;
    this.spin.add(model);
    const [x, y, z] = initialRotationDegrees.map((d) => MathUtils.degToRad(d));
    this.initialSpin.setFromEuler(new Euler(x ?? 0, y ?? 0, z ?? 0));
    this.reset();
  }

  hasModel(): boolean {
    return this.model !== null;
  }

  onFrame(cb: (dt: number, frame?: XRFrame) => void): void {
    this.frameCallbacks.push(cb);
  }

  onChange(cb: () => void): void {
    this.changeListeners.push(cb);
  }

  setAutoRotate(on: boolean): void {
    this.autoRotate = on;
    this.changeListeners.forEach((cb) => cb());
  }

  /** Restore the intended starting view: model orientation, XR placement and camera. */
  reset(): void {
    this.spin.quaternion.copy(this.initialSpin);
    if (this.renderer.xr.isPresenting) this.placeForXR();
    else this.anchor.position.set(0, 0, 0);
    if (!this.renderer.xr.isPresenting) {
      this.anchor.quaternion.identity();
      this.anchor.scale.setScalar(1);
      this.resetCamera();
    }
    this.changeListeners.forEach((cb) => cb());
  }

  /** Called by the desktop controls to reset the orbit camera. */
  onCameraReset: (() => void) | null = null;

  resetCamera(): void {
    const aspect = this.camera.aspect;
    // Narrow (portrait) screens need to sit further back so the molecule still fits.
    const distance = 2.3 / Math.min(1, aspect * 1.1);
    this.camera.position.set(0, 0.15, distance);
    this.camera.lookAt(0, 0, 0);
    this.onCameraReset?.();
  }

  /** XR: float the molecule in front of the visitor at a comfortable size. */
  placeForXR(): void {
    this.anchor.position.copy(XR_POSITION);
    this.anchor.quaternion.identity();
    this.anchor.scale.setScalar(XR_DEFAULT_SCALE);
  }

  /** Switch look for an immersive session: VR needs an opaque background, AR/MR shows passthrough. */
  beginXR(mode: 'vr' | 'ar'): void {
    this.scene.background = mode === 'vr' ? BACKGROUND : null;
    this.placeForXR();
  }

  endXR(): void {
    this.scene.background = null;
    this.anchor.position.set(0, 0, 0);
    this.anchor.quaternion.identity();
    this.anchor.scale.setScalar(1);
    this.resize();
    this.resetCamera();
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    if (this.renderer.xr.isPresenting) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private tick(time: number, frame?: XRFrame): void {
    const dt = Math.min(0.1, this.lastTime ? (time - this.lastTime) / 1000 : 0);
    this.lastTime = time;
    if (this.autoRotate && !this.interacting && this.model) {
      this.spin.rotateOnWorldAxis(new Vector3(0, 1, 0), AUTO_ROTATE_SPEED * dt);
    }
    this.frameCallbacks.forEach((cb) => cb(dt, frame));
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    if (this.model) disposeObject(this.model);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function disposeObject(root: Group): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((m) => m.dispose());
  });
}
