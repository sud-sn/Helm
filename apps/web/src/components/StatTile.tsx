import { Card, Group, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import { ICON_SIZE, ICON_STROKE, type AppIcon } from '@/icons';
import { TONES, type Tone } from '@/theme/tokens';

/** A headline number: sentence-case label, semibold value, optional status icon. */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: number | string;
  icon?: AppIcon;
  tone?: Tone;
  hint?: ReactNode;
}) {
  return (
    <Card padding="md">
      <Stack gap={4}>
        <Group gap={6} wrap="nowrap">
          {Icon ? (
            <Icon
              size={ICON_SIZE.sm}
              stroke={ICON_STROKE}
              style={{
                color: `light-dark(${TONES[tone].light}, ${TONES[tone].dark})`,
                flex: 'none',
              }}
              aria-hidden
            />
          ) : null}
          <Text size="sm" c="dimmed" truncate title={label}>
            {label}
          </Text>
        </Group>
        <Text fz={28} fw={650} lh={1.15}>
          {value}
        </Text>
        {hint ? (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
