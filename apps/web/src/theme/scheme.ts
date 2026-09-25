import type { CSSProperties } from 'react';
import classes from './scheme.module.css';

/** Put on an element whose colour differs by colour scheme, together with schemeVars(). */
export const schemeClass = classes.scheme;

/** The value for the active colour scheme, for use in that element's inline style. */
export const SCHEME_VALUE = 'var(--scheme-value)';

/** Inline variables holding the light-scheme and dark-scheme values. */
export function schemeVars(light: string, dark: string): CSSProperties {
  return { '--scheme-light': light, '--scheme-dark': dark } as CSSProperties;
}
