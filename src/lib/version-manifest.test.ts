import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../public/version.json'), 'utf8'));

describe('update manifest', () => {
  it('reports version 2.1.0', () => {
    expect(manifest.version).toBe('2.1.1');
  });

  it('keeps a download link for every platform', () => {
    for (const key of ['macArm', 'macIntel', 'windows']) {
      expect(typeof manifest[key]).toBe('string');
      expect(manifest[key].length).toBeGreaterThan(0);
    }
  });

  it('lists release notes and the planned roadmap', () => {
    expect(Array.isArray(manifest.notes)).toBe(true);
    expect(manifest.notes.length).toBeGreaterThan(0);
    expect(manifest.roadmap.map((r: { version: string }) => r.version)).toEqual(['2.2', '2.3', '3.0']);
  });
});
