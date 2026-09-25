import { Box, Group, Stack, Text, Tooltip } from '@mantine/core';
import { TICKET_STATUS_LABELS, type StatusCount } from '@helm/shared';
import { StatusTag } from '@/components/domain-tags';
import { SCHEME_VALUE, schemeClass, schemeVars } from '@/theme/scheme';
import { CHART_SERIES } from '@/theme/tokens';

/**
 * Tickets per workflow stage. One series in one hue (the stage is on the axis, not in the
 * colour); each bar is labelled with its value and has a hover tooltip.
 */
export function StatusBars({ counts }: { counts: StatusCount[] }) {
  const max = Math.max(1, ...counts.map((c) => c.count));
  const total = counts.reduce((sum, c) => sum + c.count, 0);
  return (
    <Stack gap={10} role="list" aria-label="Tickets by status">
      {counts.map(({ status, count }) => (
        <Group key={status} gap="sm" wrap="nowrap" role="listitem">
          <Box w={120} style={{ flex: 'none' }}>
            <StatusTag status={status} />
          </Box>
          <Tooltip label={`${TICKET_STATUS_LABELS[status]}: ${count} of ${total} tickets`}>
            <Box style={{ flex: 1, height: 14, display: 'flex', alignItems: 'center' }}>
              <Box
                className={schemeClass}
                style={{
                  ...schemeVars(CHART_SERIES.light, CHART_SERIES.dark),
                  width: `${(count / max) * 100}%`,
                  minWidth: count > 0 ? 4 : 0,
                  height: 10,
                  borderRadius: '0 4px 4px 0',
                  background: SCHEME_VALUE,
                }}
              />
            </Box>
          </Tooltip>
          <Text size="sm" fw={600} w={36} ta="right" className="tabular">
            {count}
          </Text>
        </Group>
      ))}
    </Stack>
  );
}
