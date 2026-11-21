import './styles/main.css';
import { DesktopControls } from './controls/DesktopControls';
import { loadProtein } from './proteins/ProteinManager';
import { AppError, findEntry, loadRegistry, proteinIdFromPath, type Registry } from './proteins/ProteinRegistry';
import { ViewerControls } from './ui/ViewerControls';
import { ProteinViewer } from './viewer/ProteinViewer';
import { XRManager } from './xr/XRManager';

/** Wires everything together. This file knows nothing about any specific protein. */
async function main(): Promise<void> {
  const app = document.getElementById('app')!;
  const container = document.getElementById('viewer')!;

  let viewer: ProteinViewer | null = null;
  let desktop: DesktopControls | null = null;
  let xr: XRManager | null = null;

  const ui = new ViewerControls(app, {
    onToggleRotate: () => desktop?.toggleAutoRotate(),
    onReset: () => viewer?.reset(),
    onFullscreen: () => {
      if (document.fullscreenElement) void document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) void document.documentElement.requestFullscreen().catch(() => ui.toast('Fullscreen is not available here.'));
      else ui.toast('Fullscreen is not supported on this device.');
    },
    onEnterXR: (mode) => {
      xr?.enter(mode).catch((err: Error) => {
        ui.toast(err.message);
        console.error(err);
      });
    },
    onExitXR: () => void xr?.exit(),
  });
  ui.showLoading(null);

  let registry: Registry;
  try {
    registry = await loadRegistry();
  } catch (err) {
    return fail(err);
  }

  let entry;
  try {
    entry = findEntry(registry, proteinIdFromPath(location.pathname, registry));
  } catch (err) {
    ui.showError(...errorText(err), registry.proteins.map((p) => ({ label: `Open ${p.name}`, href: `/protein/${p.id}` })));
    return;
  }

  try {
    viewer = new ProteinViewer(container);
  } catch (err) {
    return fail(err);
  }
  desktop = new DesktopControls(viewer, (m) => ui.toast(m));
  viewer.onChange(() => ui.setAutoRotate(viewer!.autoRotate));

  xr = new XRManager(viewer);
  xr.onStateChange((s) => {
    ui.setXRState(s);
    ui.toast(s === 'idle' ? 'Left immersive mode' : 'Immersive mode on. A/X = reset, B/Y = exit.');
  });
  xr.detect().then((s) => ui.setXRSupport(s)).catch(() => undefined);

  try {
    const protein = await loadProtein(entry, (f) => ui.showLoading(f));
    const rotation = protein.metadata.display?.initialRotationDegrees;
    viewer.setModel(protein.model, Array.isArray(rotation) ? (rotation as number[]) : undefined);
    ui.showProtein(protein.metadata);
    ui.hideLoading();
    container.querySelector('canvas')?.focus({ preventScroll: true });
  } catch (err) {
    fail(err);
  }

  function errorText(err: unknown): [string, string] {
    if (err instanceof AppError) return [err.title, err.message];
    console.error(err);
    return ['Something went wrong', err instanceof Error ? err.message : String(err)];
  }

  function fail(err: unknown): void {
    ui.showError(...errorText(err));
  }
}

void main();
