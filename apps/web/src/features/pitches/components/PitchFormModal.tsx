import {
  Alert,
  Button,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createPitchSchema, updatePitchSchema, type Pitch } from '@helm/shared';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { useClients } from '@/features/clients/api';
import { useProjects } from '@/features/projects/api';
import { apiErrors, validate } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { useCreatePitch, useUpdatePitch } from '../api';

interface Values {
  clientId: string | null;
  projectId: string | null;
  title: string;
  summary: string;
  proposal: string;
  estimateHours: number | null;
}

const PROPOSAL_TEMPLATE = `## Scope\n- \n\n## Approach\n- \n\n## Deliverables\n- \n\n## Timeline and effort\n- \n\n## Assumptions and risks\n- `;

interface Props {
  opened: boolean;
  onClose: () => void;
  clientId?: string;
  projectId?: string;
  pitch?: Pitch;
}

export function PitchFormModal({ opened, onClose, ...props }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={props.pitch ? 'Edit pitch' : 'New pitch'}
      size="xl"
    >
      <PitchForm onClose={onClose} {...props} />
    </Modal>
  );
}

function PitchForm({ onClose, clientId, projectId, pitch }: Omit<Props, 'opened'>) {
  const navigate = useNavigate();
  const create = useCreatePitch();
  const update = useUpdatePitch(pitch?.id ?? '');
  const clients = useClients();
  const [values, setValues] = useState<Values>(() => ({
    clientId: pitch?.clientId ?? clientId ?? null,
    projectId: pitch?.projectId ?? projectId ?? null,
    title: pitch?.title ?? '',
    summary: pitch?.summary ?? '',
    proposal: pitch?.proposal ?? PROPOSAL_TEMPLATE,
    estimateHours: pitch?.estimateHours ?? null,
  }));
  const projects = useProjects(values.clientId ?? undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (pitch) {
      const result = validate(updatePitchSchema, {
        projectId: values.projectId,
        title: values.title,
        summary: values.summary,
        proposal: values.proposal,
        estimateHours: values.estimateHours,
      });
      if (result.errors) return setErrors(result.errors);
      update.mutate(result.data, {
        onSuccess: () => {
          showSuccess('Pitch saved');
          onClose();
        },
        onError: (error) => setErrors(apiErrors(error)),
      });
      return;
    }
    const result = validate(createPitchSchema, values);
    if (result.errors) return setErrors(result.errors);
    create.mutate(result.data, {
      onSuccess: (created) => {
        showSuccess('Draft pitch created');
        onClose();
        void navigate(paths.pitch(created.id));
      },
      onError: (error) => setErrors(apiErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {errors.form ? <Alert color="red">{errors.form}</Alert> : null}
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select
            label="Client"
            placeholder="Choose a client"
            data={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={values.clientId}
            onChange={(value) => setValues({ ...values, clientId: value, projectId: null })}
            disabled={Boolean(pitch || clientId)}
            error={errors.clientId}
            searchable
          />
          <Select
            label="Project"
            description="Leave empty for a new engagement"
            placeholder="No project yet"
            data={(projects.data ?? []).map((p) => ({
              value: p.id,
              label: `${p.key} · ${p.name}`,
            }))}
            value={values.projectId}
            onChange={(value) => setValues({ ...values, projectId: value })}
            disabled={!values.clientId || Boolean(projectId)}
            clearable
          />
        </SimpleGrid>
        <TextInput
          label="Title"
          placeholder="Real-time inventory pipeline"
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.currentTarget.value })}
          error={errors.title}
        />
        <Textarea
          label="Summary"
          description="The client's problem or opportunity, in a few sentences."
          autosize
          minRows={2}
          value={values.summary}
          onChange={(e) => setValues({ ...values, summary: e.currentTarget.value })}
          error={errors.summary}
        />
        <MarkdownEditor
          label="Proposal"
          value={values.proposal}
          onChange={(proposal) => setValues({ ...values, proposal })}
          minRows={10}
          error={errors.proposal}
        />
        <NumberInput
          label="Estimated effort (hours)"
          min={0}
          max={10000}
          decimalScale={1}
          w={240}
          value={values.estimateHours ?? ''}
          onChange={(value) =>
            setValues({ ...values, estimateHours: typeof value === 'number' ? value : null })
          }
          error={errors.estimateHours}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {pitch ? 'Save' : 'Create draft'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
