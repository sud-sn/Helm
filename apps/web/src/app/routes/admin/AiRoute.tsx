import { Alert, Anchor, Button, Card, Code, Group, Stack, Table, Text, Title } from '@mantine/core';
import { Link } from 'react-router';
import { AI_TASK_LABELS, type AiRun } from '@helm/shared';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { UserLabel } from '@/components/UserAvatar';
import { useAiStatus, useTestAiConnection } from '@/features/ai/api';
import { ActionIcons, ICON_STROKE, NavIcons, StatusIcons } from '@/icons';
import { formatDateTime } from '@/lib/format';
import { paths } from '@/lib/paths';

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function Setting({ label, value }: { label: string; value: string | null }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="sm" c="dimmed" w={130}>
        {label}
      </Text>
      <Text size="sm" ff="monospace">
        {value ?? '—'}
      </Text>
    </Group>
  );
}

function RunStatus({ run }: { run: AiRun }) {
  return run.status === 'succeeded' ? (
    <Tag tone="success" icon={StatusIcons.done}>
      Succeeded
    </Tag>
  ) : (
    <Tag tone="danger" icon={ActionIcons.warning} title={run.errorKind ?? undefined}>
      Failed{run.errorKind ? ` · ${run.errorKind.replace('_', ' ')}` : ''}
    </Tag>
  );
}

/**
 * The AI connection (Azure OpenAI) and every request made through it. The API key lives only in
 * the server's environment; this page never shows it.
 */
export function AiRoute() {
  const status = useAiStatus();
  const test = useTestAiConnection();

  return (
    <>
      <PageHeader
        title="AI assistant"
        description="Helm uses Azure OpenAI to suggest action items from meeting transcripts. People review every suggestion before it becomes a ticket."
      />
      <QueryState query={status}>
        {(data) => (
          <Stack gap="lg">
            <Card>
              <Group justify="space-between" mb="md" wrap="wrap">
                <Group gap="xs">
                  <NavIcons.ai size={20} stroke={ICON_STROKE} aria-hidden />
                  <Title order={3}>Connection</Title>
                  {data.enabled ? (
                    <Tag tone="success" icon={StatusIcons.done}>
                      Configured
                    </Tag>
                  ) : (
                    <Tag tone="neutral" icon={StatusIcons.todo}>
                      Not configured
                    </Tag>
                  )}
                </Group>
                {data.enabled ? (
                  <Button
                    variant="light"
                    leftSection={<ActionIcons.start size={16} stroke={ICON_STROKE} />}
                    onClick={() => test.mutate()}
                    loading={test.isPending}
                  >
                    Test connection
                  </Button>
                ) : null}
              </Group>
              {data.enabled ? (
                <Stack gap={6}>
                  <Setting label="Provider" value="Azure OpenAI" />
                  <Setting label="Endpoint" value={data.endpointHost} />
                  <Setting label="Deployment" value={data.deployment} />
                  <Setting label="API version" value={data.apiVersion} />
                  {test.data ? (
                    <Alert color="green" mt="sm" title="Connected">
                      {test.data.model} answered in {seconds(test.data.durationMs)}.{' '}
                      {test.data.responseFormat === 'json_schema'
                        ? 'It supports structured outputs.'
                        : 'This model version has JSON mode only; Helm checks every answer itself.'}
                    </Alert>
                  ) : null}
                  {test.error ? (
                    <Alert color="red" mt="sm" title="The test failed">
                      {test.error.message}
                    </Alert>
                  ) : null}
                </Stack>
              ) : (
                <Stack gap="xs">
                  <Text size="sm">
                    Set these on the server (in <Code>.env</Code>, or the container's environment)
                    and restart Helm:
                  </Text>
                  <Code block>
                    {[
                      'AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com',
                      'AZURE_OPENAI_API_KEY=<key from the Azure portal>',
                      'AZURE_OPENAI_DEPLOYMENT=<your GPT-4o deployment name>',
                    ].join('\n')}
                  </Code>
                </Stack>
              )}
            </Card>

            <Card p={0}>
              <Group px="md" pt="md" pb="xs" gap="xs">
                <Title order={3}>Recent requests</Title>
                <Text size="xs" c="dimmed">
                  The last 50, newest first. Transcripts are not stored here.
                </Text>
              </Group>
              {data.recentRuns.length === 0 ? (
                <EmptyState icon={NavIcons.ai} title="No AI requests yet" />
              ) : (
                <Table.ScrollContainer minWidth={860}>
                  <Table verticalSpacing="xs" horizontalSpacing="md" className="tabular">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>When</Table.Th>
                        <Table.Th>Request</Table.Th>
                        <Table.Th>By</Table.Th>
                        <Table.Th>Model</Table.Th>
                        <Table.Th ta="right">Tokens in / out</Table.Th>
                        <Table.Th ta="right">Time</Table.Th>
                        <Table.Th>Result</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {data.recentRuns.map((run) => (
                        <Table.Tr key={run.id}>
                          <Table.Td>
                            <Text size="sm">{formatDateTime(run.createdAt)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{AI_TASK_LABELS[run.task]}</Text>
                            {run.meeting ? (
                              <Anchor component={Link} to={paths.meeting(run.meeting.id)} size="xs">
                                {run.meeting.title}
                              </Anchor>
                            ) : null}
                          </Table.Td>
                          <Table.Td>
                            <UserLabel user={run.requestedBy} fallback="—" />
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" ff="monospace">
                              {run.model}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm">
                              {run.inputTokens.toLocaleString()} /{' '}
                              {run.outputTokens.toLocaleString()}
                            </Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text size="sm">{run.durationMs ? seconds(run.durationMs) : '—'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <RunStatus run={run} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Card>
          </Stack>
        )}
      </QueryState>
    </>
  );
}
