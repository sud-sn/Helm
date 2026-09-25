import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { replaceMatrixBlock } from './rbac-matrix';

describe('docs/architecture/rbac.md', () => {
  it('matches the permission matrix in code (run `npm run docs:rbac` to update it)', () => {
    const docPath = fileURLToPath(new URL('../../../docs/architecture/rbac.md', import.meta.url));
    const document = readFileSync(docPath, 'utf8');
    expect(replaceMatrixBlock(document)).toBe(document);
  });
});
