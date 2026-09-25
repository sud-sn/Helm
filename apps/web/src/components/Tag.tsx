import type { CSSProperties, ReactNode } from 'react';
import { ICON_SIZE, ICON_STROKE, type AppIcon } from '@/icons';
import { TONES, type Tone } from '@/theme/tokens';
import classes from './Tag.module.css';

const toneStyle = (tone: Tone) =>
  ({ '--tag-light': TONES[tone].light, '--tag-dark': TONES[tone].dark }) as CSSProperties;

interface TagProps {
  tone: Tone;
  icon?: AppIcon;
  /** A coloured dot instead of an icon (for identities such as roles). */
  dot?: boolean;
  /** No background or border: icon + label inline with text. */
  bare?: boolean;
  children: ReactNode;
  title?: string;
}

/** State shown as icon + label, never colour alone (see the design system). */
export function Tag({ tone, icon: Icon, dot, bare, children, title }: TagProps) {
  return (
    <span
      className={`${classes.tag} ${bare ? classes.bare : ''}`}
      style={toneStyle(tone)}
      title={title}
    >
      {dot ? <span className={classes.dot} aria-hidden /> : null}
      {Icon ? <Icon size={ICON_SIZE.xs} stroke={ICON_STROKE} aria-hidden /> : null}
      <span className={classes.label}>{children}</span>
    </span>
  );
}

/** A tone-coloured icon with an accessible label, for dense places like board cards. */
export function ToneIcon({
  tone,
  icon: Icon,
  label,
  size = ICON_SIZE.sm,
}: {
  tone: Tone;
  icon: AppIcon;
  label: string;
  size?: number;
}) {
  return (
    <span
      className={classes.iconOnly}
      style={toneStyle(tone)}
      title={label}
      role="img"
      aria-label={label}
    >
      <Icon size={size} stroke={ICON_STROKE} aria-hidden />
    </span>
  );
}
