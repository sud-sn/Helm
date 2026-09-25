import {
  Anchor,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  TagsInput,
  Text,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { Link } from 'react-router';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
  hasPermission,
  type TicketDetail,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  type UpdateTicketInput,
} from '@helm/shared';
import { PriorityTag, StatusTag, TypeTag } from '@/components/domain-tags';
import { UserLabel } from '@/components/UserAvatar';
import { useCurrentUser } from '@/features/auth/api';
import { useCycles } from '@/features/cycles/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { formatDate, formatDateTime } from '@/lib/format';
import { paths } from '@/lib/paths';
import { canChangeStatus, canEditTicket } from '@/lib/ticket-permissions';
import { useAssignableUsers, useUpdateTicket, useWatchTicket } from '../api';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

/** The ticket's properties. Editable fields depend on the viewer's permissions. */
export function TicketFields({ ticket }: { ticket: TicketDetail }) {
  const user = useCurrentUser();
  const update = useUpdateTicket();
  const watch = useWatchTicket(ticket.key);
  const cycles = useCycles(ticket.projectKey);
  const assignable = useAssignableUsers(ticket.projectKey, ticket.cycleId);
  const full = canEditTicket(user, ticket);
  const statusEditable = canChangeStatus(user, ticket);
  const save = (input: UpdateTicketInput) => update.mutate({ key: ticket.key, ...input });
  const projectScope = { clientId: ticket.clientId, projectId: ticket.projectId };
  const cycleOptions = [
    ...(hasPermission(user.grants, { ...projectScope, cycleId: null }, 'ticket.update')
      ? [{ value: '', label: 'Backlog' }]
      : []),
    ...(cycles.data ?? [])
      .filter((cycle) => cycle.status !== 'completed' || cycle.id === ticket.cycleId)
      .filter(
        (cycle) =>
          cycle.id === ticket.cycleId ||
          hasPermission(user.grants, { ...projectScope, cycleId: cycle.id }, 'ticket.update'),
      )
      .map((cycle) => ({ value: cycle.id, label: cycle.name })),
  ];

  return (
    <Card>
      <Stack gap="md">
        <Field label="Status">
          {statusEditable ? (
            <Select
              aria-label="Status"
              data={TICKET_STATUSES.map((value) => ({ value, label: TICKET_STATUS_LABELS[value] }))}
              value={ticket.status}
              onChange={(value) =>
                value && value !== ticket.status && save({ status: value as TicketStatus })
              }
              allowDeselect={false}
            />
          ) : (
            <StatusTag status={ticket.status} />
          )}
        </Field>
        <Field label="Assignee">
          {full ? (
            <Select
              aria-label="Assignee"
              placeholder="Unassigned"
              searchable
              clearable
              data={[
                ...(ticket.assignee &&
                !(assignable.data ?? []).some((p) => p.id === ticket.assignee?.id)
                  ? [{ value: ticket.assignee.id, label: ticket.assignee.displayName }]
                  : []),
                ...(assignable.data ?? []).map((person) => ({
                  value: person.id,
                  label: person.displayName,
                })),
              ]}
              value={ticket.assignee?.id ?? null}
              onChange={(value) =>
                value !== (ticket.assignee?.id ?? null) && save({ assigneeId: value })
              }
            />
          ) : (
            <UserLabel user={ticket.assignee} />
          )}
        </Field>
        <Group grow>
          <Field label="Priority">
            {full ? (
              <Select
                aria-label="Priority"
                data={TICKET_PRIORITIES.map((value) => ({
                  value,
                  label: TICKET_PRIORITY_LABELS[value],
                }))}
                value={ticket.priority}
                onChange={(value) =>
                  value && value !== ticket.priority && save({ priority: value as TicketPriority })
                }
                allowDeselect={false}
              />
            ) : (
              <PriorityTag priority={ticket.priority} />
            )}
          </Field>
          <Field label="Type">
            {full ? (
              <Select
                aria-label="Type"
                data={TICKET_TYPES.map((value) => ({ value, label: TICKET_TYPE_LABELS[value] }))}
                value={ticket.type}
                onChange={(value) =>
                  value && value !== ticket.type && save({ type: value as TicketType })
                }
                allowDeselect={false}
              />
            ) : (
              <TypeTag type={ticket.type} />
            )}
          </Field>
        </Group>
        <Field label="Cycle">
          {full ? (
            <Select
              aria-label="Cycle"
              data={cycleOptions}
              value={ticket.cycleId ?? ''}
              onChange={(value) =>
                value !== null &&
                value !== (ticket.cycleId ?? '') &&
                save({ cycleId: value || null })
              }
              allowDeselect={false}
            />
          ) : (
            <Text size="sm">{ticket.cycleName ?? 'Backlog'}</Text>
          )}
        </Field>
        <Group grow>
          <Field label="Due">
            {full ? (
              <DateInput
                aria-label="Due date"
                clearable
                valueFormat="D MMM YYYY"
                value={ticket.dueDate}
                onChange={(value) => value !== ticket.dueDate && save({ dueDate: value })}
              />
            ) : (
              <Text size="sm">{formatDate(ticket.dueDate)}</Text>
            )}
          </Field>
          <Field label="Estimate (h)">
            {full ? (
              <NumberInput
                aria-label="Estimate in hours"
                min={0}
                decimalScale={1}
                defaultValue={ticket.estimateHours ?? ''}
                onBlur={(event) => {
                  const raw = event.currentTarget.value.trim();
                  const next = raw === '' ? null : Number(raw);
                  if (next !== ticket.estimateHours && (next === null || Number.isFinite(next)))
                    save({ estimateHours: next });
                }}
              />
            ) : (
              <Text size="sm">{ticket.estimateHours ?? '—'}</Text>
            )}
          </Field>
        </Group>
        <Field label="Labels">
          {full ? (
            <TagsInput
              aria-label="Labels"
              maxTags={10}
              value={ticket.labels}
              onChange={(labels) => save({ labels })}
              placeholder="Add a label"
            />
          ) : (
            <Text size="sm">
              {ticket.labels.length ? ticket.labels.map((l) => `#${l}`).join(' ') : '—'}
            </Text>
          )}
        </Field>
        <Divider />
        <Field label="Reporter">
          <UserLabel user={ticket.reporter} />
        </Field>
        {ticket.sourceMeeting ? (
          <Field label="From meeting">
            <Anchor component={Link} to={paths.meeting(ticket.sourceMeeting.id)} size="sm">
              {ticket.sourceMeeting.title}
            </Anchor>
          </Field>
        ) : null}
        <Text size="xs" c="dimmed">
          Created {formatDateTime(ticket.createdAt)}
          <br />
          Updated {formatDateTime(ticket.updatedAt)}
          {ticket.completedAt ? (
            <>
              <br />
              Completed {formatDateTime(ticket.completedAt)}
            </>
          ) : null}
        </Text>
        <Button
          variant={ticket.watching ? 'light' : 'default'}
          leftSection={
            ticket.watching ? (
              <ActionIcons.unwatch size={16} stroke={ICON_STROKE} />
            ) : (
              <ActionIcons.watch size={16} stroke={ICON_STROKE} />
            )
          }
          onClick={() => watch.mutate(!ticket.watching)}
          loading={watch.isPending}
        >
          {ticket.watching ? 'Stop watching' : 'Watch'} · {ticket.watcherCount}
        </Button>
      </Stack>
    </Card>
  );
}
