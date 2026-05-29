// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import '../public/bricked-up-88.js';

describe('bricked-up-88 custom element', () => {
  it('registers a portable iframe wrapper for the built app', () => {
    expect(customElements.get('bricked-up-88')).toBeDefined();

    const element = document.createElement('bricked-up-88');
    document.body.appendChild(element);

    const iframe = element.shadowRoot?.querySelector('iframe');

    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toContain('index.html');
    expect(iframe?.getAttribute('title')).toBe("Bricked Up! '88");
  });
});
