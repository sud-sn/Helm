import { Button, Card, Code, Group, Select, Table, Text } from '@mantine/core';
import { useState } from 'react';
import type { AuditEntry } from '@helm/shared';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { useAuditLog } from '@/features/admin/api';
import { formatDateTime } from '@/lib/format';

const ACTIONS = [
  'auth.login',
  'auth.login_failed',
  'auth.logout',
  'auth.password_changed',
  'user.created',
  'user.updated',
  'user.password_reset',
  'role.granted',
  'role.revoked',
  'client.created',
  'client.updated',
  'project.created',
  'project.updated',
  'cycle.deleted',
  'ticket.deleted',
  'tickets.imported',
  'page.deleted',
  'page.visibility_changed',
  'meeting.deleted',
  'meeting.visibility_changed',
  'meeting.action_items_suggested',
  'pitch.sent',
  'pitch.responded',
  'pitch.withdrawn',
];

function summary(entry: AuditEntry): string {
  const entries = Object.entries(entry.data).filter(
    ([, value]) => value !== null && value !== undefined,
  );
  return entries
    .map(
      ([key, value]) =>
        `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`,
    )
    .join(' · ');
}

export function AuditRoute() {
  const [action, setAction] = useState<string | null>(null);
  const [before, setBefore] = useState<string | undefined>();
  const log = useAuditLog({ action: action ?? undefined, before });

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sign-ins, account and access changes, sharing with clients, deletions and imports."
      />
      <Group mb="md">
        <Select
          aria-label="Filter by action"
          placeholder="All actions"
          data={ACTIONS}
          value={action}
          onChange={(value) => {
            setAction(value);
            setBefore(undefined);
          }}
          clearable
          searchable
          w={280}
        />
        {before ? (
          <Button variant="subtle" onClick={() => setBefore(undefined)}>
            Back to newest
          </Button>
        ) : null}
      </Group>
      <QueryState query={log}>
        {(entries) => (
          <Card p={0}>
            <Table.ScrollContainer minWidth={820}>
              <Table verticalSpacing="xs" horizontalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>When</Table.Th>
                    <Table.Th>Who</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Details</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {entries.map((entry) => (
                    <Table.Tr key={entry.id}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>
                        <Text size="sm">{formatDateTime(entry.createdAt)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{entry.actor?.displayName ?? '—'}</Text>
                        {entry.ip ? (
                          <Text size="xs" c="dimmed">
                            {entry.ip}
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        <Code>{entry.action}</Code>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed" lineClamp={2}>
                          {summary(entry)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {entries.length === 100 ? (
              <Group justify="center" p="sm">
                <Button
                  variant="subtle"
                  onClick={() => setBefore(entries[entries.length - 1]!.createdAt)}
                >
                  Older entries
                </Button>
              </Group>
            ) : null}
          </Card>
        )}
      </QueryState>
    </>
  );
}
