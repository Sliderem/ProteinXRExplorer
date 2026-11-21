import { BufferGeometry, Float32BufferAttribute, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { ProteinViewer } from '../viewer/ProteinViewer';

/*
 * Quest controller mapping (WebXR "xr-standard" gamepad layout):
 *   Trigger or Grip (hold) ... grab: the molecule follows your hand's rotation and movement
 *   Thumbstick forward/back .. make the molecule bigger / smaller
 *   A or X button ............ reset the molecule's position, rotation and size
 *   B or Y button ............ exit VR / mixed reality
 * Hand tracking and two-handed pinch-scaling are future enhancements.
 */
const BUTTON_RESET = 4; // A / X
const BUTTON_EXIT = 5; // B / Y
const AXIS_STICK_Y = 3;
const DEADZONE = 0.25;
const SCALE_RATE = 1.0; // e-folds per second at full deflection
const MIN_SCALE = 0.05;
const MAX_SCALE = 2.5;

interface Grab {
  controller: Group;
  startHandPos: Vector3;
  startHandQuat: Quaternion;
  startAnchorPos: Vector3;
  startAnchorQuat: Quaternion;
}

export class XRInteractions {
  private controllers: Group[] = [];
  private sources = new Map<Group, XRInputSource>();
  private buttonDown = new Map<Group, boolean[]>();
  private grab: Grab | null = null;
  private enabled = false;
  private cleanups: (() => void)[] = [];

  constructor(
    private viewer: ProteinViewer,
    private requestExit: () => void,
  ) {
    viewer.onFrame((dt) => this.update(dt));
  }

  /** Called when an immersive session starts. Handlers are attached once per session. */
  enable(): void {
    if (this.enabled) return;
    this.enabled = true;
    for (let i = 0; i < 2; i++) {
      const controller = this.viewer.renderer.xr.getController(i);
      const onConnected = (e: { data?: XRInputSource }) => {
        if (e.data) this.sources.set(controller, e.data);
        controller.visible = true;
      };
      const onDisconnected = () => {
        this.sources.delete(controller);
        this.buttonDown.delete(controller);
        if (this.grab?.controller === controller) this.endGrab();
        controller.visible = false;
      };
      const onStart = () => this.startGrab(controller);
      const onEnd = () => {
        if (this.grab?.controller === controller) this.endGrab();
      };
      controller.add(makePointer());
      this.viewer.scene.add(controller);
      controller.addEventListener('connected', onConnected as never);
      controller.addEventListener('disconnected', onDisconnected);
      controller.addEventListener('selectstart', onStart);
      controller.addEventListener('squeezestart', onStart);
      controller.addEventListener('selectend', onEnd);
      controller.addEventListener('squeezeend', onEnd);
      this.controllers.push(controller);
      this.cleanups.push(() => {
        controller.removeEventListener('connected', onConnected as never);
        controller.removeEventListener('disconnected', onDisconnected);
        controller.removeEventListener('selectstart', onStart);
        controller.removeEventListener('squeezestart', onStart);
        controller.removeEventListener('selectend', onEnd);
        controller.removeEventListener('squeezeend', onEnd);
        this.viewer.scene.remove(controller);
        controller.traverse((o) => {
          const m = o as Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
        });
        controller.clear(); // drop the pointer visuals
      });
    }
  }

  /** Called when the session ends: removes every handler and visual so nothing is duplicated next time. */
  disable(): void {
    this.endGrab();
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.controllers = [];
    this.sources.clear();
    this.buttonDown.clear();
    this.enabled = false;
  }

  private startGrab(controller: Group): void {
    if (this.grab) return; // one hand at a time
    const anchor = this.viewer.anchor;
    this.grab = {
      controller,
      startHandPos: controller.position.clone(),
      startHandQuat: controller.quaternion.clone(),
      startAnchorPos: anchor.position.clone(),
      startAnchorQuat: anchor.quaternion.clone(),
    };
    this.viewer.interacting = true;
  }

  private endGrab(): void {
    this.grab = null;
    this.viewer.interacting = false;
  }

  private update(dt: number): void {
    if (!this.enabled) return;
    const anchor = this.viewer.anchor;

    if (this.grab) {
      const g = this.grab;
      // Rotate the molecule by the same amount the hand has rotated, and move it with the hand.
      const delta = g.controller.quaternion.clone().multiply(g.startHandQuat.clone().invert());
      anchor.quaternion.copy(delta.multiply(g.startAnchorQuat));
      anchor.position.copy(g.startAnchorPos).add(g.controller.position.clone().sub(g.startHandPos));
    }

    for (const controller of this.controllers) {
      const pad = this.sources.get(controller)?.gamepad;
      if (!pad) continue; // hand-tracking sources have no gamepad

      const y = pad.axes[AXIS_STICK_Y] ?? 0;
      if (Math.abs(y) > DEADZONE) {
        const next = anchor.scale.x * Math.exp(-y * SCALE_RATE * dt); // push forward (y < 0) = bigger
        anchor.scale.setScalar(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
      }

      const previous = this.buttonDown.get(controller) ?? [];
      const now = pad.buttons.map((b) => b.pressed);
      if (now[BUTTON_RESET] && !previous[BUTTON_RESET]) {
        this.endGrab();
        this.viewer.reset();
      }
      if (now[BUTTON_EXIT] && !previous[BUTTON_EXIT]) this.requestExit();
      this.buttonDown.set(controller, now);
    }
  }
}

/** A thin pointer ray with a small tip, so visitors can see where each controller points. */
function makePointer(): Group {
  const group = new Group();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, -0.6], 3));
  group.add(new Line(geometry, new LineBasicMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.7 })));
  const tip = new Mesh(new SphereGeometry(0.008, 12, 12), new MeshBasicMaterial({ color: 0xffffff }));
  group.add(tip);
  return group;
}
