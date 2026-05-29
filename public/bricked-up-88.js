const TAG_NAME = 'bricked-up-88';

const normalizeSize = (value) => (/^\d+$/.test(value) ? `${value}px` : value);

class BrickedUp88Element extends HTMLElement {
  constructor() {
    super();
    this._iframe = null;
  }

  static get observedAttributes() {
    return ['width', 'height', 'title'];
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      this.render();
    }

    this.syncAttributes();
  }

  attributeChangedCallback() {
    this.syncAttributes();
  }

  render() {
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    const iframe = document.createElement('iframe');

    style.textContent = `
      :host {
        display: block;
        width: min(100%, 960px);
        aspect-ratio: 4 / 3;
      }

      iframe {
        width: 100%;
        height: 100%;
        display: block;
        border: 0;
        background: #000;
      }
    `;

    iframe.src = new URL('./index.html', import.meta.url).toString();
    iframe.allow = 'autoplay';
    iframe.loading = 'lazy';

    shadow.append(style, iframe);
    this._iframe = iframe;
  }

  syncAttributes() {
    if (!this._iframe) {
      return;
    }

    const width = this.getAttribute('width');
    const height = this.getAttribute('height');

    this.style.width = width ? normalizeSize(width) : '';
    this.style.height = height ? normalizeSize(height) : '';
    this.style.aspectRatio = height ? 'auto' : '';
    this._iframe.title = this.getAttribute('title') || "Bricked Up! '88";
  }
}

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, BrickedUp88Element);
}
