import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  createProjectSchema,
  updateProjectSchema,
  type Project,
  type ProjectStatus,
} from '@helm/shared';
import { apiErrors, validate } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { useCreateProject, useUpdateProject } from '../api';

interface Values {
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  clientId?: string;
  project?: Project;
}

export function ProjectFormModal({ opened, onClose, clientId, project }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={project ? 'Project settings' : 'New project'}
      size="lg"
    >
      <ProjectForm onClose={onClose} clientId={clientId} project={project} />
    </Modal>
  );
}

/** Mounted fresh each time the modal opens. */
function ProjectForm({ onClose, clientId, project }: Omit<Props, 'opened'>) {
  const navigate = useNavigate();
  const create = useCreateProject();
  const update = useUpdateProject(project?.key ?? '');
  const [values, setValues] = useState<Values>(() => ({
    key: project?.key ?? '',
    name: project?.name ?? '',
    description: project?.description ?? '',
    status: project?.status ?? 'active',
    startDate: project?.startDate ?? null,
    targetDate: project?.targetDate ?? null,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (project) {
      const result = validate(updateProjectSchema, {
        name: values.name,
        description: values.description,
        status: values.status,
        startDate: values.startDate,
        targetDate: values.targetDate,
      });
      if (result.errors) return setErrors(result.errors);
      update.mutate(result.data, {
        onSuccess: () => {
          showSuccess('Project updated');
          onClose();
        },
        onError: (error) => setErrors(apiErrors(error)),
      });
      return;
    }
    const result = validate(createProjectSchema, { ...values, clientId });
    if (result.errors) return setErrors(result.errors);
    create.mutate(result.data, {
      onSuccess: (created) => {
        showSuccess(`${created.name} created`);
        onClose();
        void navigate(paths.project(created.key));
      },
      onError: (error) => setErrors(apiErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {errors.form ? <Alert color="red">{errors.form}</Alert> : null}
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput
            label="Key"
            description="Prefix of ticket numbers"
            placeholder="ACME"
            disabled={Boolean(project)}
            value={values.key}
            onChange={(e) => setValues({ ...values, key: e.currentTarget.value.toUpperCase() })}
            error={errors.key}
            maxLength={10}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)' } }}
          />
          <TextInput
            label="Name"
            placeholder="Retail analytics platform"
            style={{ gridColumn: 'span 2' }}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.currentTarget.value })}
            error={errors.name}
          />
        </SimpleGrid>
        <Textarea
          label="Description"
          autosize
          minRows={2}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.currentTarget.value })}
          error={errors.description}
        />
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {project ? (
            <Select
              label="Status"
              data={PROJECT_STATUSES.map((status) => ({
                value: status,
                label: PROJECT_STATUS_LABELS[status],
              }))}
              value={values.status}
              onChange={(value) =>
                value && setValues({ ...values, status: value as ProjectStatus })
              }
              allowDeselect={false}
            />
          ) : null}
          <DateInput
            label="Start date"
            clearable
            valueFormat="D MMM YYYY"
            value={values.startDate}
            onChange={(value) => setValues({ ...values, startDate: value })}
            error={errors.startDate}
          />
          <DateInput
            label="Target date"
            clearable
            valueFormat="D MMM YYYY"
            value={values.targetDate}
            onChange={(value) => setValues({ ...values, targetDate: value })}
            error={errors.targetDate}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {project ? 'Save' : 'Create project'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
