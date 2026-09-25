import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createPageSchema } from '@helm/shared';
import { apiErrors, validate } from '@/lib/forms';
import { paths } from '@/lib/paths';
import { useCreatePage } from '../api';

const DOC_TEMPLATE = `## Purpose\n\n## Source\n\n## Target\n\n## Transformations\n\n## Schedule and dependencies\n\n## Data quality checks\n\n## Runbook\n`;

/** Starts a page (optionally linked to a ticket) and opens the editor. */
interface Props {
  opened: boolean;
  onClose: () => void;
  projectKey: string;
  ticketId?: string;
  defaultTitle?: string;
}

export function NewPageModal({ opened, onClose, ...props }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="New page">
      <NewPageForm onClose={onClose} {...props} />
    </Modal>
  );
}

function NewPageForm({ onClose, projectKey, ticketId, defaultTitle = '' }: Omit<Props, 'opened'>) {
  const navigate = useNavigate();
  const create = useCreatePage(projectKey);
  const [title, setTitle] = useState(defaultTitle);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(createPageSchema, { title, body: DOC_TEMPLATE, ticketId });
    if (result.errors) return setErrors(result.errors);
    create.mutate(result.data, {
      onSuccess: (page) => {
        onClose();
        void navigate(paths.pageEdit(page.id));
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
          placeholder="Orders pipeline — technical design"
          data-autofocus
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          error={errors.title}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create and edit
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
