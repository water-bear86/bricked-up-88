import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('transportable app shell', () => {
  it('does not depend on external CDNs, hosted fonts, or root-absolute assets', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

    expect(html).not.toContain('https://cdn.tailwindcss.com');
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
    expect(html).not.toContain('href="/vite.svg"');
  });
});
