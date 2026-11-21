import type { ProteinMetadata } from '../proteins/ProteinManager';
import type { XRMode, XRState, XRSupport } from '../xr/XRManager';

export interface UIHandlers {
  onToggleRotate(): void;
  onReset(): void;
  onFullscreen(): void;
  onEnterXR(mode: XRMode): void;
  onExitXR(): void;
}

type Attrs = Record<string, string>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children); // strings become text nodes: safe against HTML injection
  return node;
}

/** All on-screen interface: header, toolbar, info panel, loading and error states. */
export class ViewerControls {
  private title = el('h1', { id: 'protein-name' }, 'Protein XR Explorer');
  private subtitle = el('p', { class: 'tagline' }, 'Explore the invisible architecture of life.');
  private info = el('section', { id: 'info-panel', class: 'panel', 'aria-label': 'Scientific information', hidden: '' });
  private loading = el('div', { class: 'overlay', role: 'status' });
  private bar = el('div', { class: 'bar-fill' });
  private barTrack = el('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Loading model' }, this.bar);
  private errorBox = el('div', { class: 'overlay', role: 'alert', hidden: '' });
  private toastBox = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  private xrNote = el('p', { class: 'xr-note', role: 'status' });
  private rotateBtn = this.button('Auto-rotate', 'Pause or resume automatic rotation (Space)', 'rotate');
  private resetBtn = this.button('Reset view', 'Reset the molecule and camera (R)', 'reset');
  private fullscreenBtn = this.button('Fullscreen', 'Toggle fullscreen', 'fullscreen');
  private infoBtn = this.button('Science info', 'Show or hide scientific information', 'info');
  private vrBtn = this.button('Enter VR', 'Enter virtual reality', 'vr');
  private mrBtn = this.button('Enter MR', 'Enter mixed reality (passthrough)', 'mr');
  private exitBtn = this.button('Exit XR', 'Leave virtual or mixed reality', 'exit');

  constructor(private root: HTMLElement, handlers: UIHandlers) {
    this.loading.append(el('p', {}, 'Loading molecule…'), this.barTrack);
    this.vrBtn.hidden = this.mrBtn.hidden = this.exitBtn.hidden = true;
    this.infoBtn.setAttribute('aria-expanded', 'false');
    this.infoBtn.setAttribute('aria-controls', 'info-panel');

    const header = el('header', { class: 'header' }, el('p', { class: 'brand' }, 'PROTEIN XR EXPLORER'), this.title, this.subtitle);
    const toolbar = el('nav', { class: 'toolbar', 'aria-label': 'Viewer controls' }, this.rotateBtn, this.resetBtn, this.fullscreenBtn, this.infoBtn, this.vrBtn, this.mrBtn, this.exitBtn);
    const hint = el('p', { class: 'hint' }, 'Drag to rotate · Scroll or pinch to zoom');
    this.root.append(header, this.info, toolbar, this.xrNote, hint, this.loading, this.errorBox, this.toastBox);

    this.rotateBtn.addEventListener('click', handlers.onToggleRotate);
    this.resetBtn.addEventListener('click', handlers.onReset);
    this.fullscreenBtn.addEventListener('click', handlers.onFullscreen);
    this.vrBtn.addEventListener('click', () => handlers.onEnterXR('vr'));
    this.mrBtn.addEventListener('click', () => handlers.onEnterXR('ar'));
    this.exitBtn.addEventListener('click', handlers.onExitXR);
    this.infoBtn.addEventListener('click', () => {
      const open = this.info.hidden;
      this.info.hidden = !open;
      this.infoBtn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('fullscreenchange', () => {
      this.fullscreenBtn.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
    });
    this.setAutoRotate(true);
  }

  private button(label: string, tip: string, id: string): HTMLButtonElement {
    return el('button', { type: 'button', class: 'btn', title: tip, 'data-action': id }, label);
  }

  setAutoRotate(on: boolean): void {
    this.rotateBtn.setAttribute('aria-pressed', String(on));
    this.rotateBtn.textContent = on ? 'Pause rotation' : 'Resume rotation';
  }

  showLoading(fraction: number | null): void {
    this.loading.hidden = false;
    if (fraction === null) {
      this.barTrack.removeAttribute('aria-valuenow');
      this.bar.style.width = '35%';
      this.bar.classList.add('indeterminate');
    } else {
      this.bar.classList.remove('indeterminate');
      this.bar.style.width = `${Math.round(fraction * 100)}%`;
      this.barTrack.setAttribute('aria-valuenow', String(Math.round(fraction * 100)));
    }
  }

  hideLoading(): void {
    this.loading.hidden = true;
  }

  showError(title: string, message: string, links: { label: string; href: string }[] = []): void {
    this.hideLoading();
    this.errorBox.hidden = false;
    this.errorBox.replaceChildren(
      el('h2', {}, title),
      el('p', {}, message),
      ...links.map((l) => el('a', { href: l.href, class: 'btn' }, l.label)),
      el('button', { type: 'button', class: 'btn', 'data-action': 'retry' }, 'Try again'),
    );
    this.errorBox.querySelector('[data-action=retry]')?.addEventListener('click', () => location.reload());
  }

  clearError(): void {
    this.errorBox.hidden = true;
  }

  showProtein(meta: ProteinMetadata): void {
    document.title = `${meta.name} · Protein XR Explorer`;
    this.title.textContent = meta.name;
    const rows: [string, Node | string][] = [
      ['Protein', meta.name],
      ['Organism', el('i', {}, meta.organism)],
      ['UniProt', el('a', { href: meta.source.uniprotUrl, target: '_blank', rel: 'noopener noreferrer' }, meta.source.uniprot)],
      ['Structure source', el('a', { href: meta.source.url, target: '_blank', rel: 'noopener noreferrer' }, `${meta.source.database} ${meta.source.accession}`)],
      ['Residues', String(meta.structure.residueCount)],
    ];
    const dl = el('dl');
    rows.forEach(([k, v]) => dl.append(el('dt', {}, k), el('dd', {}, v)));

    const parts: Node[] = [el('h2', {}, 'About this molecule'), el('p', {}, meta.description), dl];
    parts.push(el('p', { class: 'notice' }, meta.structure.notice));
    if (meta.model) {
      const legend = el('ul', { class: 'legend', 'aria-label': 'Colour legend' });
      meta.model.legend.forEach((item) => legend.append(el('li', {}, el('span', { class: 'swatch', style: `background:${item.colour}` }), item.label)));
      parts.push(
        el('h3', {}, `Colours: ${meta.model.colouring}`),
        legend,
        el('p', { class: 'small' }, `${meta.model.legendNote} Shown as: ${meta.model.representation.toLowerCase()}.`),
      );
    }
    if (meta.source.attribution) parts.push(el('p', { class: 'small' }, `Credit: ${meta.source.attribution}. Licence: ${meta.source.licence ?? 'see source'}.`));
    this.info.replaceChildren(...parts);
    const open = window.matchMedia('(min-width: 700px)').matches; // collapsed on phones so the molecule stays prominent
    this.info.hidden = !open;
    this.infoBtn.setAttribute('aria-expanded', String(open));
  }

  private support: XRSupport | null = null;

  setXRSupport(support: XRSupport): void {
    this.support = support;
    this.vrBtn.hidden = !support.vr;
    this.mrBtn.hidden = !support.ar;
    if (support.vr || support.ar) {
      this.xrNote.textContent = '';
    } else if (!support.secureContext) {
      this.xrNote.textContent = 'VR/MR needs a secure (https) connection. See docs/quest-testing.md.';
    } else if (!support.webxr) {
      this.xrNote.textContent = 'VR and mixed reality are not available in this browser. Try a Meta Quest browser.';
    } else {
      this.xrNote.textContent = 'No VR or mixed-reality headset detected on this device.';
    }
  }

  setXRState(state: XRState): void {
    const inXR = state !== 'idle';
    this.exitBtn.hidden = !inXR;
    this.vrBtn.hidden = inXR || !this.support?.vr;
    this.mrBtn.hidden = inXR || !this.support?.ar;
  }

  /** Show a short message that screen readers also announce. */
  toast(message: string): void {
    this.toastBox.textContent = message;
    this.toastBox.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastBox.classList.remove('show'), 2600);
  }
  private toastTimer: number | undefined;
}
