import { Group, Text } from '@mantine/core';

/** The Helm mark: a ship's wheel. `onDark` swaps the rim to a light colour for the navy header. */
export function HelmMark({ size = 28, onDark = false }: { size?: number; onDark?: boolean }) {
  const rim = onDark ? 'var(--mantine-color-helm-2)' : 'var(--mantine-color-helm-6)';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Helm">
      <g stroke={rim} strokeWidth="2.25" strokeLinecap="round">
        <line x1="16" y1="2" x2="16" y2="30" />
        <line x1="2" y1="16" x2="30" y2="16" />
        <line x1="6.1" y1="6.1" x2="25.9" y2="25.9" />
        <line x1="25.9" y1="6.1" x2="6.1" y2="25.9" />
      </g>
      <circle cx="16" cy="16" r="9.5" stroke={rim} strokeWidth="2.5" />
      <circle cx="16" cy="16" r="3.6" fill="var(--mantine-color-brass-5)" />
    </svg>
  );
}

export function Logo({ onDark = false, subtitle }: { onDark?: boolean; subtitle?: string }) {
  return (
    <Group gap={10} wrap="nowrap">
      <HelmMark onDark={onDark} />
      <div>
        <Text fw={700} size="lg" lh={1.1} c={onDark ? 'white' : undefined}>
          Helm
        </Text>
        {subtitle ? (
          <Text size="xs" c={onDark ? 'navy.2' : 'dimmed'} lh={1.2}>
            {subtitle}
          </Text>
        ) : null}
      </div>
    </Group>
  );
}
