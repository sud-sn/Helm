/**
 * Design tokens. See docs/design/design-system.md for how these were chosen and checked.
 * Components use tones and domain maps from here — never raw hex values.
 */
import type { MantineColorsTuple } from '@mantine/core';
import type {
  ActionItemStatus,
  CycleStatus,
  PitchStatus,
  Role,
  TicketPriority,
  TicketStatus,
  TicketType,
  Visibility,
} from '@helm/shared';

/** OKLCH-generated ramps; shade 6 is the light-mode filled colour, shade 8 the dark-mode one. */
export const brandColors = {
  helm: [
    '#eef9fd',
    '#d4effa',
    '#aedff3',
    '#80cae7',
    '#50b2d6',
    '#0099c1',
    '#007d9f',
    '#006884',
    '#00536a',
    '#003e51',
  ],
  navy: [
    '#f1f5fc',
    '#dde5f2',
    '#bdcce2',
    '#9bafce',
    '#7991b4',
    '#58739b',
    '#3a567f',
    '#274064',
    '#182e4e',
    '#0e1f39',
  ],
  brass: [
    '#fcf6ee',
    '#f6e7d4',
    '#ecd1ae',
    '#dcb783',
    '#c99b5a',
    '#b37f2d',
    '#986600',
    '#7e5400',
    '#654200',
    '#4d3100',
  ],
} satisfies Record<string, MantineColorsTuple>;

/**
 * Meaning, not colour. Each tone has a light- and dark-scheme step that keeps icons and borders
 * at ≥ 3:1 against the surface; labels always use the normal text colour.
 */
export type Tone =
  | 'neutral'
  | 'brand'
  | 'info'
  | 'review'
  | 'uat'
  | 'success'
  | 'warning'
  | 'danger'
  | 'client'
  | 'special';

const shade = (color: string, index: number) => `var(--mantine-color-${color}-${index})`;

export const TONES: Record<Tone, { light: string; dark: string; mantine: string }> = {
  neutral: { light: shade('gray', 7), dark: shade('gray', 4), mantine: 'gray' },
  brand: { light: shade('helm', 7), dark: shade('helm', 4), mantine: 'helm' },
  info: { light: shade('blue', 8), dark: shade('blue', 4), mantine: 'blue' },
  review: { light: shade('violet', 7), dark: shade('violet', 4), mantine: 'violet' },
  uat: { light: shade('cyan', 9), dark: shade('cyan', 4), mantine: 'cyan' },
  success: { light: shade('green', 9), dark: shade('green', 4), mantine: 'green' },
  warning: { light: shade('orange', 9), dark: shade('orange', 4), mantine: 'orange' },
  danger: { light: shade('red', 8), dark: shade('red', 4), mantine: 'red' },
  client: { light: shade('brass', 6), dark: shade('brass', 4), mantine: 'brass' },
  special: { light: shade('grape', 7), dark: shade('grape', 4), mantine: 'grape' },
};

export const STATUS_TONE: Record<TicketStatus, Tone> = {
  todo: 'neutral',
  in_progress: 'info',
  blocked: 'danger',
  in_review: 'review',
  uat: 'uat',
  done: 'success',
  cancelled: 'neutral',
};

export const PRIORITY_TONE: Record<TicketPriority, Tone> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

export const TYPE_TONE: Record<TicketType, Tone> = {
  task: 'info',
  bug: 'danger',
  pipeline: 'brand',
  report: 'uat',
  data_model: 'special',
  data_quality: 'warning',
  investigation: 'review',
};

export const PITCH_STATUS_TONE: Record<PitchStatus, Tone> = {
  draft: 'neutral',
  in_review: 'review',
  sent: 'client',
  changes_requested: 'warning',
  accepted: 'success',
  rejected: 'danger',
  withdrawn: 'neutral',
};

export const CYCLE_STATUS_TONE: Record<CycleStatus, Tone> = {
  planned: 'neutral',
  active: 'brand',
  completed: 'success',
};

export const VISIBILITY_TONE: Record<Visibility, Tone> = {
  internal: 'neutral',
  client: 'client',
};

export const ACTION_ITEM_TONE: Record<ActionItemStatus, Tone> = {
  suggested: 'review',
  open: 'neutral',
  converted: 'success',
  dismissed: 'neutral',
};

/** Identity, not state: a coloured dot next to the role name. */
export const ROLE_COLOR: Record<Role, string> = {
  DELIVERY_MANAGER: 'grape',
  PROJECT_MANAGER: 'indigo',
  TEAM_LEAD: 'helm',
  BUSINESS_ANALYST: 'cyan',
  DEVELOPER: 'blue',
  VIEWER: 'gray',
  CLIENT: 'brass',
};

/** Single-series chart marks (bars, meters): 4.7:1 on light, 6.4:1 on dark surfaces. */
export const CHART_SERIES = { light: shade('helm', 6), dark: shade('helm', 4) };
