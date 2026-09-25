import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AI_TASK_LABELS, aiSettingsSchema, type AiRun, type AiStatus } from '@helm/shared';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { UserLabel } from '@/components/UserAvatar';
import {
  useAiStatus,
  useRemoveAiSettings,
  useSaveAiSettings,
  useTestAiConnection,
} from '@/features/ai/api';
import { ActionIcons, ICON_STROKE, NavIcons, StatusIcons } from '@/icons';
import { formatDateTime } from '@/lib/format';
import { apiErrors, validate } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
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

function StateTag({ status }: { status: AiStatus }) {
  if (status.problem) {
    return (
      <Tag tone="warning" icon={ActionIcons.warning}>
        Needs attention
      </Tag>
    );
  }
  return status.enabled ? (
    <Tag tone="success" icon={StatusIcons.done}>
      Connected
    </Tag>
  ) : (
    <Tag tone="neutral" icon={StatusIcons.todo}>
      Not connected
    </Tag>
  );
}

/**
 * The Azure OpenAI connection. The key is write-only: once saved, only its last four characters
 * are ever shown. Saving tests the settings against Azure first and keeps them only if they work.
 */
function SettingsForm({ status }: { status: AiStatus }) {
  const save = useSaveAiSettings();
  const remove = useRemoveAiSettings();
  const [confirmRemove, removeModal] = useDisclosure(false);
  const [values, setValues] = useState(() => ({
    endpoint: status.endpoint ?? '',
    deployment: status.deployment ?? '',
    apiVersion: status.apiVersion ?? '2024-10-21',
    apiKey: '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saved = status.keyHint !== null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(aiSettingsSchema, {
      ...values,
      apiKey: values.apiKey.trim() || undefined,
    });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    save.mutate(result.data, {
      onSuccess: () => showSuccess('Azure OpenAI answered the test request.', 'AI connected'),
      onError: (error) => setErrors(apiErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput
            label="Endpoint"
            description="Azure portal → your Azure OpenAI resource → Keys and Endpoint"
            placeholder="https://my-resource.openai.azure.com"
            value={values.endpoint}
            onChange={(e) => setValues({ ...values, endpoint: e.currentTarget.value })}
            error={errors.endpoint}
            required
          />
          <TextInput
            label="Deployment name"
            description="The name you gave your GPT-4o deployment in Azure AI Foundry"
            placeholder="gpt-4o"
            value={values.deployment}
            onChange={(e) => setValues({ ...values, deployment: e.currentTarget.value })}
            error={errors.deployment}
            required
          />
          <PasswordInput
            label="API key"
            description={
              saved
                ? 'Leave empty to keep the saved key. Stored encrypted; never shown again.'
                : 'KEY 1 or KEY 2 from the same page. Stored encrypted; never shown again.'
            }
            placeholder={saved ? `Saved key ending in ${status.keyHint}` : 'Paste the key'}
            autoComplete="off"
            value={values.apiKey}
            onChange={(e) => setValues({ ...values, apiKey: e.currentTarget.value })}
            error={errors.apiKey}
            required={!saved}
          />
          <TextInput
            label="API version"
            description="Leave as it is unless your Azure resource needs another version"
            value={values.apiVersion}
            onChange={(e) => setValues({ ...values, apiVersion: e.currentTarget.value })}
            error={errors.apiVersion}
          />
        </SimpleGrid>
        {errors.form ? (
          <Alert color="red" title="Not saved">
            {errors.form.replace(/^Not saved: /, '')}
          </Alert>
        ) : null}
        <Group justify="space-between" wrap="wrap">
          <Text size="xs" c="dimmed">
            {status.updatedAt
              ? `Last changed ${formatDateTime(status.updatedAt)}${
                  status.updatedBy ? ` by ${status.updatedBy.displayName}` : ''
                }.`
              : 'Saving sends a short test request to Azure first; nothing is saved if it fails.'}
          </Text>
          <Group gap="xs">
            {saved ? (
              <Button variant="subtle" color="red" onClick={removeModal.open}>
                Remove
              </Button>
            ) : null}
            <Button
              type="submit"
              loading={save.isPending}
              leftSection={<ActionIcons.check size={16} stroke={ICON_STROKE} />}
            >
              Save and test
            </Button>
          </Group>
        </Group>
      </Stack>
      <ConfirmModal
        opened={confirmRemove}
        onClose={removeModal.close}
        title="Switch AI off?"
        confirmLabel="Remove connection"
        danger
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              removeModal.close();
              showSuccess('The Azure OpenAI connection and its key were removed.');
            },
          })
        }
      >
        The saved key is deleted. AI suggestions stop until someone connects Azure OpenAI again.
      </ConfirmModal>
    </form>
  );
}

function ConnectionCard({ status }: { status: AiStatus }) {
  const test = useTestAiConnection();
  return (
    <Card>
      <Group justify="space-between" mb="md" wrap="wrap">
        <Group gap="xs">
          <NavIcons.ai size={20} stroke={ICON_STROKE} aria-hidden />
          <Title order={3}>Azure OpenAI connection</Title>
          <StateTag status={status} />
        </Group>
        {status.enabled ? (
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
      <Stack gap="md">
        {status.problem ? (
          <Alert color="orange" title="AI is off until this is fixed">
            {status.problem}
          </Alert>
        ) : null}
        {test.data ? (
          <Alert color="green" title="Connected" withCloseButton onClose={() => test.reset()}>
            {test.data.model} answered in {seconds(test.data.durationMs)}.{' '}
            {test.data.responseFormat === 'json_schema'
              ? 'It supports structured outputs.'
              : 'This model version has JSON mode only; Helm checks every answer itself.'}
          </Alert>
        ) : null}
        {test.error ? (
          <Alert color="red" title="The test failed" withCloseButton onClose={() => test.reset()}>
            {test.error.message}
          </Alert>
        ) : null}
        {status.editable ? (
          // Re-mounts after every save, so the form starts from what is stored.
          <SettingsForm key={status.updatedAt ?? 'new'} status={status} />
        ) : (
          <Stack gap={6}>
            <Text size="sm">
              Set by the server's environment variables. To change it, edit them on the server and
              restart Helm.
            </Text>
            <Setting label="Endpoint" value={status.endpointHost} />
            <Setting label="Deployment" value={status.deployment} />
            <Setting label="API version" value={status.apiVersion} />
          </Stack>
        )}
      </Stack>
    </Card>
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

function RecentRequests({ runs }: { runs: AiRun[] }) {
  return (
    <Card p={0}>
      <Group px="md" pt="md" pb="xs" gap="xs">
        <Title order={3}>Recent requests</Title>
        <Text size="xs" c="dimmed">
          The last 50, newest first. Transcripts are not stored here.
        </Text>
      </Group>
      {runs.length === 0 ? (
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
              {runs.map((run) => (
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
                      {run.inputTokens.toLocaleString()} / {run.outputTokens.toLocaleString()}
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
  );
}

/** Connect Azure OpenAI and see every request made through it. */
export function AiRoute() {
  const status = useAiStatus();
  return (
    <>
      <PageHeader
        title="AI assistant"
        description="Helm uses your Azure OpenAI deployment to suggest action items from meeting transcripts. People review every suggestion before it becomes a ticket."
      />
      <QueryState query={status}>
        {(data) => (
          <Stack gap="lg">
            <ConnectionCard status={data} />
            <RecentRequests runs={data.recentRuns} />
          </Stack>
        )}
      </QueryState>
    </>
  );
}
