import { Group, Progress, Stack, Text, Tooltip } from '@mantine/core';
import type { ReactNode } from 'react';
import { percent } from '@/lib/format';
import { SCHEME_VALUE, schemeClass, schemeVars } from '@/theme/scheme';

/**
 * Progress against a total: helm fill on a lighter step of the same ramp, with the numbers
 * always written out next to it.
 */
export function Meter({
  label,
  done,
  total,
  extra,
}: {
  label: ReactNode;
  done: number;
  total: number;
  extra?: ReactNode;
}) {
  const value = percent(done, total);
  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <div style={{ minWidth: 0 }}>{label}</div>
        <Text size="xs" c="dimmed" className="tabular" style={{ whiteSpace: 'nowrap' }}>
          {done} of {total} done · {value}%
        </Text>
      </Group>
      <Tooltip label={`${done} of ${total} tickets done (${value}%)`}>
        <Progress
          value={value}
          size={8}
          radius="xl"
          color="helm"
          aria-label={`${value}% done`}
          className={schemeClass}
          style={schemeVars('var(--mantine-color-helm-1)', 'var(--mantine-color-helm-9)')}
          styles={{ root: { background: SCHEME_VALUE } }}
        />
      </Tooltip>
      {extra}
    </Stack>
  );
}
