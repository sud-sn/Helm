import { Alert, Button, Group, Modal, Stack, TextInput, Textarea } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { createClientSchema, type Client } from '@helm/shared';
import { apiErrors, validate } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { useCreateClient, useUpdateClient } from '../api';

interface Props {
  opened: boolean;
  onClose: () => void;
  client?: Client;
}

export function ClientFormModal({ opened, onClose, client }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={client ? 'Edit client' : 'New client'}>
      <ClientForm client={client} onClose={onClose} />
    </Modal>
  );
}

/** Mounted fresh each time the modal opens, so the form always starts from the current values. */
function ClientForm({ client, onClose }: Omit<Props, 'opened'>) {
  const create = useCreateClient();
  const update = useUpdateClient(client?.id ?? '');
  const [values, setValues] = useState({
    name: client?.name ?? '',
    description: client?.description ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(createClientSchema, values);
    if (result.errors) return setErrors(result.errors);
    const options = {
      onSuccess: () => {
        showSuccess(client ? 'Client updated' : `${result.data.name} added`);
        onClose();
      },
      onError: (error: unknown) => setErrors(apiErrors(error)),
    };
    if (client) update.mutate(result.data, options);
    else create.mutate(result.data, options);
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {errors.form ? <Alert color="red">{errors.form}</Alert> : null}
        <TextInput
          label="Client name"
          placeholder="Acme Retail"
          data-autofocus
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.currentTarget.value })}
          error={errors.name}
        />
        <Textarea
          label="Description"
          placeholder="What we do for this client"
          autosize
          minRows={2}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.currentTarget.value })}
          error={errors.description}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {client ? 'Save' : 'Add client'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
