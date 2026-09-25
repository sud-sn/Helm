import { Alert, Button, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useState, type FormEvent } from 'react';
import { ROLE_ALLOWED_SCOPES, ROLE_LABELS, type Role, type ScopeType } from '@helm/shared';
import { useCycles } from '@/features/cycles/api';
import { useProjects } from '@/features/projects/api';
import { apiErrors } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { useDirectory, useGrantRole } from '../api';

const ROLE_HELP: Record<Role, string> = {
  DELIVERY_MANAGER: 'Sees and manages everything in the workspace.',
  PROJECT_MANAGER: 'Runs the account: plans cycles, approves pitches, manages the team.',
  TEAM_LEAD: 'Runs day-to-day delivery: creates and assigns tickets, converts meeting actions.',
  BUSINESS_ANALYST: 'Records meetings, writes pitches and documents, shares them with the client.',
  DEVELOPER: 'Works assigned tickets, comments, records meetings and writes documentation.',
  VIEWER: 'Read-only access.',
  CLIENT: 'Client user: sees progress and what the team shares, responds to pitches.',
};

/**
 * Adds someone to a client or project. For projects the grant can be narrowed to one cycle.
 * Only roles the current user may hand out are offered; the API re-checks everything.
 */
interface Props {
  opened: boolean;
  onClose: () => void;
  scopeType: ScopeType;
  scopeId?: string;
  clientId?: string;
  projectId?: string;
  grantableRoles: Role[];
}

export function AddMemberModal({ opened, onClose, ...props }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="Add member">
      <AddMemberForm onClose={onClose} {...props} />
    </Modal>
  );
}

function AddMemberForm({
  onClose,
  scopeType,
  scopeId,
  clientId,
  projectId,
  grantableRoles,
}: Omit<Props, 'opened'>) {
  const [role, setRole] = useState<Role | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [target, setTarget] = useState<string>('here');
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 250);
  const [error, setError] = useState<string | null>(null);
  const grant = useGrantRole();

  const isClientRole = role === 'CLIENT';
  const directory = useDirectory(
    isClientRole ? { clientId, q: debounced || undefined } : { q: debounced || undefined },
    true,
  );
  const projects = useProjects(clientId);
  const project = projects.data?.find((p) => p.id === projectId);
  const cycles = useCycles(project?.key);

  const cycleOptions =
    scopeType === 'project' && role && ROLE_ALLOWED_SCOPES[role].includes('cycle')
      ? (cycles.data ?? []).filter((cycle) => cycle.status !== 'completed')
      : [];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!role || !userId) return setError('Choose a person and a role.');
    const narrowToCycle = target !== 'here';
    grant.mutate(
      {
        userId,
        role,
        scopeType: narrowToCycle ? 'cycle' : scopeType,
        scopeId: narrowToCycle ? target : (scopeId ?? null),
      },
      {
        onSuccess: (assignment) => {
          showSuccess(`${assignment.user.displayName} added as ${ROLE_LABELS[assignment.role]}`);
          onClose();
        },
        onError: (err) => setError(apiErrors(err).form ?? Object.values(apiErrors(err))[0] ?? null),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {error ? <Alert color="red">{error}</Alert> : null}
        <Select
          label="Role"
          placeholder="Choose a role"
          data={grantableRoles.map((value) => ({ value, label: ROLE_LABELS[value] }))}
          value={role}
          onChange={(value) => {
            setRole(value as Role | null);
            setUserId(null);
          }}
          allowDeselect={false}
        />
        {role ? (
          <Text size="xs" c="dimmed" mt={-8}>
            {ROLE_HELP[role]}
          </Text>
        ) : null}
        <Select
          label={isClientRole ? 'Client user' : 'Person'}
          placeholder={isClientRole ? 'People at this client' : 'Search by name or username'}
          searchable
          searchValue={search}
          onSearchChange={setSearch}
          data={(directory.data ?? []).map((person) => ({
            value: person.id,
            label: `${person.displayName} (@${person.username})`,
          }))}
          value={userId}
          onChange={setUserId}
          nothingFoundMessage={
            isClientRole
              ? 'No client users for this company — ask an administrator to create one'
              : 'Nobody found'
          }
          disabled={!role}
        />
        {cycleOptions.length > 0 ? (
          <Select
            label="Access to"
            data={[
              { value: 'here', label: 'The whole project' },
              ...cycleOptions.map((cycle) => ({ value: cycle.id, label: `Only ${cycle.name}` })),
            ]}
            value={target}
            onChange={(value) => setTarget(value ?? 'here')}
            allowDeselect={false}
          />
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={grant.isPending} disabled={!role || !userId}>
            Add
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
