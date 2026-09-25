import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(css|tsx?)$/.test(name) ? [path] : [];
  });
}

describe('colour-scheme styles', () => {
  // Production builds rewrote the CSS light-dark function into a fallback that needs
  // color-scheme declared in the same stylesheet; tags, boards and meters lost their colours.
  // Use theme/scheme.ts, or a data-mantine-color-scheme selector in CSS modules, instead.
  it('do not use the CSS light-dark function', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => readFileSync(path, 'utf8').includes('light-dark('))
      .map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });
});
