import type { ProteinViewer } from '../viewer/ProteinViewer';
import { XRInteractions } from './XRInteractions';

export type XRMode = 'vr' | 'ar';
export type XRState = 'idle' | XRMode;

export interface XRSupport {
  /** Page is served from a secure context (HTTPS or localhost) - WebXR requires it. */
  secureContext: boolean;
  /** Browser exposes navigator.xr at all. */
  webxr: boolean;
  vr: boolean;
  ar: boolean;
}

const SESSION_TYPE: Record<XRMode, XRSessionMode> = { vr: 'immersive-vr', ar: 'immersive-ar' };

/** Detects WebXR support and owns the (single) immersive session. */
export class XRManager {
  state: XRState = 'idle';
  private session: XRSession | null = null;
  private starting = false;
  private interactions: XRInteractions;
  private listeners: ((state: XRState) => void)[] = [];

  constructor(private viewer: ProteinViewer) {
    this.interactions = new XRInteractions(viewer, () => this.exit());
    viewer.renderer.xr.enabled = true;
    viewer.renderer.xr.setReferenceSpaceType('local-floor'); // floor-level origin: comfortable standing/seated scale
  }

  onStateChange(cb: (state: XRState) => void): void {
    this.listeners.push(cb);
  }

  async detect(): Promise<XRSupport> {
    const secureContext = window.isSecureContext;
    const xr = navigator.xr;
    if (!xr) return { secureContext, webxr: false, vr: false, ar: false };
    const check = (type: XRSessionMode) => xr.isSessionSupported(type).catch(() => false);
    const [vr, ar] = await Promise.all([check('immersive-vr'), check('immersive-ar')]);
    return { secureContext, webxr: true, vr, ar };
  }

  /** Start an immersive session. Throws an Error with a visitor-friendly message on failure. */
  async enter(mode: XRMode): Promise<void> {
    if (this.session || this.starting) return; // never create a duplicate session
    if (!navigator.xr) throw new Error('WebXR is not available in this browser.');
    this.starting = true;
    try {
      const session = await navigator.xr.requestSession(SESSION_TYPE[mode], {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      session.addEventListener('end', this.onSessionEnd);
      this.session = session;
      await this.viewer.renderer.xr.setSession(session);
      this.viewer.beginXR(mode);
      this.interactions.enable();
      this.setState(mode);
    } catch (err) {
      this.session?.removeEventListener('end', this.onSessionEnd);
      this.session = null;
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not start ${mode === 'vr' ? 'VR' : 'mixed reality'}: ${detail}`);
    } finally {
      this.starting = false;
    }
  }

  async exit(): Promise<void> {
    await this.session?.end().catch(() => undefined);
  }

  private onSessionEnd = (): void => {
    this.session?.removeEventListener('end', this.onSessionEnd);
    this.session = null;
    this.interactions.disable();
    this.viewer.endXR();
    this.setState('idle');
  };

  private setState(state: XRState): void {
    this.state = state;
    this.listeners.forEach((cb) => cb(state));
  }
}
