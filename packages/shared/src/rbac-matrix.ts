/**
 * Renders the permission matrix as Markdown for docs/architecture/rbac.md.
 * `npm run docs:rbac` rewrites the doc; rbac-matrix.test.ts fails when they drift apart.
 */
import {
  PERMISSIONS,
  ROLES,
  ROLE_ALLOWED_SCOPES,
  ROLE_GRANTABLE_ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  type Role,
} from './rbac';

const SHORT_LABELS: Record<Role, string> = {
  DELIVERY_MANAGER: 'DM',
  PROJECT_MANAGER: 'PM',
  TEAM_LEAD: 'TL',
  BUSINESS_ANALYST: 'BA',
  DEVELOPER: 'Dev',
  VIEWER: 'Viewer',
  CLIENT: 'Client',
};

export const MATRIX_START = '<!-- rbac-matrix:start -->';
export const MATRIX_END = '<!-- rbac-matrix:end -->';

export function renderRbacMatrix(): string {
  const lines = [
    `| Permission | ${ROLES.map((role) => SHORT_LABELS[role]).join(' | ')} |`,
    `|---|${ROLES.map(() => ':-:').join('|')}|`,
    ...PERMISSIONS.map(
      (permission) =>
        `| \`${permission}\` | ${ROLES.map((role) => (ROLE_PERMISSIONS[role].has(permission) ? '✓' : '')).join(' | ')} |`,
    ),
    '',
    '| Role | Can be granted at | Can grant |',
    '|---|---|---|',
    ...ROLES.map(
      (role) =>
        `| ${ROLE_LABELS[role]} | ${ROLE_ALLOWED_SCOPES[role].join(', ')} | ${
          ROLE_GRANTABLE_ROLES[role].map((granted) => ROLE_LABELS[granted]).join(', ') || '—'
        } |`,
    ),
  ];
  return lines.join('\n');
}

/** Replaces the generated block between the markers in a document. */
export function replaceMatrixBlock(document: string): string {
  const start = document.indexOf(MATRIX_START);
  const end = document.indexOf(MATRIX_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error('rbac.md is missing the rbac-matrix markers');
  }
  return `${document.slice(0, start + MATRIX_START.length)}\n${renderRbacMatrix()}\n${document.slice(end)}`;
}
