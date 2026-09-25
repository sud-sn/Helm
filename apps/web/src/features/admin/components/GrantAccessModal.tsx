import { Alert, Button, Group, Modal, Select, Stack } from '@mantine/core';
import { useState } from 'react';
import {
  ROLES,
  ROLE_ALLOWED_SCOPES,
  ROLE_LABELS,
  SCOPE_TYPE_LABELS,
  isRoleAllowedForUserType,
  type AdminUser,
  type Role,
  type ScopeType,
} from '@helm/shared';
import { useClients } from '@/features/clients/api';
import { useCycles } from '@/features/cycles/api';
import { useGrantRole } from '@/features/members/api';
import { useProjects } from '@/features/projects/api';
import { apiErrors } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';

/** Admin view: grant any role at any scope (client users only within their company). */
export function GrantAccessModal({
  opened,
  onClose,
  user,
}: {
  opened: boolean;
  onClose: () => void;
  user: AdminUser;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={`Grant access to ${user.displayName}`}>
      <GrantAccessForm onClose={onClose} user={user} />
    </Modal>
  );
}

function GrantAccessForm({ onClose, user }: { onClose: () => void; user: AdminUser }) {
  const grant = useGrantRole();
  const clients = useClients();
  const [role, setRole] = useState<Role | null>(null);
  const [scopeType, setScopeType] = useState<ScopeType | null>(null);
  const [clientId, setClientId] = useState<string | null>(
    user.userType === 'client' ? user.clientId : null,
  );
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const projects = useProjects(clientId ?? undefined);
  const cycles = useCycles(projectKey);
  const project = projects.data?.find((p) => p.key === projectKey);

  const roles = ROLES.filter((r) => isRoleAllowedForUserType(r, user.userType));
  const scopeTypes = role ? ROLE_ALLOWED_SCOPES[role] : [];
  const scopeId =
    scopeType === 'workspace'
      ? null
      : scopeType === 'client'
        ? clientId
        : scopeType === 'project'
          ? (project?.id ?? null)
          : cycleId;
  const ready = role && scopeType && (scopeType === 'workspace' || scopeId);

  return (
    <Stack>
      {error ? <Alert color="red">{error}</Alert> : null}
      <Select
        label="Role"
        data={roles.map((value) => ({ value, label: ROLE_LABELS[value] }))}
        value={role}
        onChange={(value) => {
          setRole(value as Role | null);
          setScopeType(null);
        }}
      />
      <Select
        label="Where"
        data={scopeTypes.map((value) => ({ value, label: SCOPE_TYPE_LABELS[value] }))}
        value={scopeType}
        onChange={(value) => setScopeType(value as ScopeType | null)}
        disabled={!role}
      />
      {scopeType && scopeType !== 'workspace' ? (
        <Select
          label="Client"
          data={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          value={clientId}
          onChange={(value) => {
            setClientId(value);
            setProjectKey(null);
            setCycleId(null);
          }}
          disabled={user.userType === 'client'}
          searchable
        />
      ) : null}
      {scopeType === 'project' || scopeType === 'cycle' ? (
        <Select
          label="Project"
          data={(projects.data ?? []).map((p) => ({ value: p.key, label: `${p.key} · ${p.name}` }))}
          value={projectKey}
          onChange={(value) => {
            setProjectKey(value);
            setCycleId(null);
          }}
          disabled={!clientId}
          searchable
        />
      ) : null}
      {scopeType === 'cycle' ? (
        <Select
          label="Cycle"
          data={(cycles.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          value={cycleId}
          onChange={setCycleId}
          disabled={!projectKey}
        />
      ) : null}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!ready}
          loading={grant.isPending}
          onClick={() =>
            role &&
            scopeType &&
            grant.mutate(
              { userId: user.id, role, scopeType, scopeId },
              {
                onSuccess: (assignment) => {
                  showSuccess(`${ROLE_LABELS[assignment.role]} on ${assignment.scopeLabel}`);
                  onClose();
                },
                onError: (err) => setError(Object.values(apiErrors(err))[0] ?? null),
              },
            )
          }
        >
          Grant access
        </Button>
      </Group>
    </Stack>
  );
}
