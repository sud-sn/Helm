import { Alert, Button, Group, Modal, SimpleGrid, Stack, TextInput, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useState, type FormEvent } from 'react';
import { createCycleSchema, updateCycleSchema, type Cycle } from '@helm/shared';
import { apiErrors, validate } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { useCreateCycle, useUpdateCycle } from '../api';

interface Props {
  opened: boolean;
  onClose: () => void;
  projectKey: string;
  cycle?: Cycle;
}

export function CycleFormModal({ opened, onClose, projectKey, cycle }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={cycle ? 'Edit cycle' : 'Plan a cycle'}>
      <CycleForm onClose={onClose} projectKey={projectKey} cycle={cycle} />
    </Modal>
  );
}

/** Mounted fresh each time the modal opens. */
function CycleForm({ onClose, projectKey, cycle }: Omit<Props, 'opened'>) {
  const create = useCreateCycle(projectKey);
  const update = useUpdateCycle();
  const [values, setValues] = useState(() => ({
    name: cycle?.name ?? '',
    goal: cycle?.goal ?? '',
    startDate: cycle?.startDate ?? null,
    endDate: cycle?.endDate ?? null,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const options = {
      onSuccess: () => {
        showSuccess(cycle ? 'Cycle updated' : `${values.name} planned`);
        onClose();
      },
      onError: (error: unknown) => setErrors(apiErrors(error)),
    };
    if (cycle) {
      const result = validate(updateCycleSchema, values);
      if (result.errors) return setErrors(result.errors);
      update.mutate({ id: cycle.id, ...result.data }, options);
    } else {
      const result = validate(createCycleSchema, values);
      if (result.errors) return setErrors(result.errors);
      create.mutate(result.data, options);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {errors.form ? <Alert color="red">{errors.form}</Alert> : null}
        <TextInput
          label="Name"
          placeholder="Sprint 4 · UAT phase"
          data-autofocus
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.currentTarget.value })}
          error={errors.name}
        />
        <Textarea
          label="Goal"
          placeholder="What this cycle should deliver"
          autosize
          minRows={2}
          value={values.goal}
          onChange={(e) => setValues({ ...values, goal: e.currentTarget.value })}
        />
        <SimpleGrid cols={2}>
          <DateInput
            label="Starts"
            clearable
            valueFormat="D MMM YYYY"
            value={values.startDate}
            onChange={(value) => setValues({ ...values, startDate: value })}
          />
          <DateInput
            label="Ends"
            clearable
            valueFormat="D MMM YYYY"
            value={values.endDate}
            onChange={(value) => setValues({ ...values, endDate: value })}
            error={errors.endDate}
          />
        </SimpleGrid>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {cycle ? 'Save' : 'Plan cycle'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
