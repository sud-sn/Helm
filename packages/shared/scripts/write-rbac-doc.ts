import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { replaceMatrixBlock } from '../src/rbac-matrix';

const docPath = fileURLToPath(new URL('../../../docs/architecture/rbac.md', import.meta.url));
writeFileSync(docPath, replaceMatrixBlock(readFileSync(docPath, 'utf8')));
console.log(`Updated ${docPath}`);
