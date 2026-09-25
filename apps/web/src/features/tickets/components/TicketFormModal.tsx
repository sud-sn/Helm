import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useState, type FormEvent } from 'react';
import {
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_TYPES,
  TICKET_TYPE_LABELS,
  createTicketSchema,
  type Project,
  type TicketPriority,
  type TicketType,
} from '@helm/shared';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { apiErrors, validate } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { useTicketCreateAccess } from '../create-access';
import { useAssignableUsers, useCreateTicket } from '../api';

interface Values {
  title: string;
  description: string;
  type: TicketType;
  priority: TicketPriority;
  cycleId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  labels: string[];
}

interface Props {
  opened: boolean;
  onClose: () => void;
  project: Project;
  defaultCycleId?: string | null;
}

export function TicketFormModal({ opened, onClose, project, defaultCycleId = null }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={`New ticket in ${project.key}`} size="xl">
      <TicketForm onClose={onClose} project={project} defaultCycleId={defaultCycleId} />
    </Modal>
  );
}

function TicketForm({ onClose, project, defaultCycleId = null }: Omit<Props, 'opened'>) {
  const create = useCreateTicket(project.key);
  const [values, setValues] = useState<Values>({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    cycleId: defaultCycleId,
    assigneeId: null,
    dueDate: null,
    estimateHours: null,
    labels: [],
  });
  const assignable = useAssignableUsers(project.key, values.cycleId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const access = useTicketCreateAccess(project);
  const canUseBacklog = access.backlog;
  const cycleOptions = access.cycles;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(createTicketSchema, values);
    if (result.errors) return setErrors(result.errors);
    create.mutate(result.data, {
      onSuccess: (ticket) => {
        showSuccess(`${ticket.key} created in ${ticket.cycleName ?? 'the backlog'}`);
        onClose();
      },
      onError: (error) => setErrors(apiErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {errors.form ? <Alert color="red">{errors.form}</Alert> : null}
        <TextInput
          label="Title"
          placeholder="Load SAP orders into the staging layer"
          data-autofocus
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.currentTarget.value })}
          error={errors.title}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Select
            label="Type"
            data={TICKET_TYPES.map((value) => ({ value, label: TICKET_TYPE_LABELS[value] }))}
            value={values.type}
            onChange={(value) => value && setValues({ ...values, type: value as TicketType })}
            allowDeselect={false}
          />
          <Select
            label="Priority"
            data={TICKET_PRIORITIES.map((value) => ({
              value,
              label: TICKET_PRIORITY_LABELS[value],
            }))}
            value={values.priority}
            onChange={(value) =>
              value && setValues({ ...values, priority: value as TicketPriority })
            }
            allowDeselect={false}
          />
          <Select
            label="Cycle"
            placeholder={canUseBacklog ? 'Backlog' : 'Choose a cycle'}
            data={cycleOptions.map((cycle) => ({ value: cycle.id, label: cycle.name }))}
            value={values.cycleId}
            onChange={(value) => setValues({ ...values, cycleId: value, assigneeId: null })}
            clearable={canUseBacklog}
            error={errors.cycleId}
          />
          <Select
            label="Assignee"
            placeholder="Unassigned"
            searchable
            clearable
            data={(assignable.data ?? []).map((person) => ({
              value: person.id,
              label: person.displayName,
            }))}
            value={values.assigneeId}
            onChange={(value) => setValues({ ...values, assigneeId: value })}
            error={errors.assigneeId}
          />
          <DateInput
            label="Due date"
            clearable
            valueFormat="D MMM YYYY"
            value={values.dueDate}
            onChange={(value) => setValues({ ...values, dueDate: value })}
            error={errors.dueDate}
          />
          <NumberInput
            label="Estimate (hours)"
            min={0}
            decimalScale={1}
            value={values.estimateHours ?? ''}
            onChange={(value) =>
              setValues({ ...values, estimateHours: typeof value === 'number' ? value : null })
            }
            error={errors.estimateHours}
          />
        </SimpleGrid>
        <TagsInput
          label="Labels"
          placeholder="Type and press Enter"
          maxTags={10}
          value={values.labels}
          onChange={(labels) => setValues({ ...values, labels })}
          error={errors.labels}
        />
        <MarkdownEditor
          label="Description"
          value={values.description}
          onChange={(description) => setValues({ ...values, description })}
          minRows={5}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create ticket
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
