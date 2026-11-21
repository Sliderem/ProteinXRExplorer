import { Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ProteinViewer } from '../viewer/ProteinViewer';

const RESUME_DELAY_MS = 2500;

/**
 * Mouse / trackpad / touch / keyboard control for the desktop view.
 * Dragging orbits the camera around the molecule; the wheel or pinch zooms.
 * Auto-rotation pauses while the visitor is interacting and resumes shortly after.
 */
export class DesktopControls {
  private controls: OrbitControls;
  private resumeTimer: number | undefined;

  constructor(
    private viewer: ProteinViewer,
    private onToast: (message: string) => void,
  ) {
    const el = viewer.renderer.domElement;
    this.controls = new OrbitControls(viewer.camera, el);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false; // keeps the molecule from being lost off-screen
    this.controls.minDistance = 0.9; // cannot fly inside the molecule
    this.controls.maxDistance = 6; // cannot lose it in the distance
    this.controls.rotateSpeed = 0.8;
    this.controls.zoomSpeed = 0.8;

    this.controls.addEventListener('start', () => {
      window.clearTimeout(this.resumeTimer);
      viewer.interacting = true;
    });
    this.controls.addEventListener('end', () => {
      window.clearTimeout(this.resumeTimer);
      this.resumeTimer = window.setTimeout(() => (viewer.interacting = false), RESUME_DELAY_MS);
    });

    viewer.onCameraReset = () => {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    };
    viewer.onFrame(() => {
      if (!viewer.renderer.xr.isPresenting) this.controls.update();
    });

    el.tabIndex = 0;
    el.addEventListener('keydown', (e) => this.onKey(e));
  }

  toggleAutoRotate(): void {
    this.viewer.setAutoRotate(!this.viewer.autoRotate);
    this.onToast(this.viewer.autoRotate ? 'Auto-rotate on' : 'Auto-rotate paused');
  }

  private onKey(e: KeyboardEvent): void {
    const step = 0.15;
    switch (e.key) {
      case 'ArrowLeft': this.viewer.spin.rotateOnWorldAxis(Y_AXIS, -step); break;
      case 'ArrowRight': this.viewer.spin.rotateOnWorldAxis(Y_AXIS, step); break;
      case 'ArrowUp': this.viewer.spin.rotateOnWorldAxis(X_AXIS, -step); break;
      case 'ArrowDown': this.viewer.spin.rotateOnWorldAxis(X_AXIS, step); break;
      case '+': case '=': this.zoom(0.9); break;
      case '-': case '_': this.zoom(1.1); break;
      case 'r': case 'R': this.viewer.reset(); break;
      case ' ': this.toggleAutoRotate(); break;
      default: return;
    }
    e.preventDefault();
  }

  private zoom(factor: number): void {
    const cam = this.viewer.camera;
    const dist = cam.position.length() * factor;
    cam.position.setLength(Math.min(this.controls.maxDistance, Math.max(this.controls.minDistance, dist)));
  }

  dispose(): void {
    window.clearTimeout(this.resumeTimer);
    this.controls.dispose();
  }
}

const X_AXIS = new Vector3(1, 0, 0);
const Y_AXIS = new Vector3(0, 1, 0);
