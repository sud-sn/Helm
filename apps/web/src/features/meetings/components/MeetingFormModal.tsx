import {
  Alert,
  Button,
  FileButton,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createMeetingSchema, updateMeetingSchema, type Meeting } from '@helm/shared';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { useClients } from '@/features/clients/api';
import { useProjects } from '@/features/projects/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { todayIso } from '@/lib/format';
import { apiErrors, validate } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { useCreateMeeting, useUpdateMeeting } from '../api';

interface Values {
  clientId: string | null;
  projectId: string | null;
  title: string;
  meetingDate: string | null;
  attendees: string;
  transcript: string;
  minutes: string;
}

const MINUTES_TEMPLATE = `## Summary\n\n## Decisions\n- \n\n## Next steps\n- `;
const TRANSCRIPT_TYPES = '.txt,.vtt,.srt,.md,text/plain,text/vtt';

/** Records a meeting. Transcripts can be pasted or loaded from a text export (Teams/Zoom .vtt). */
interface Props {
  opened: boolean;
  onClose: () => void;
  clientId?: string;
  projectId?: string;
  meeting?: Meeting;
}

export function MeetingFormModal({ opened, onClose, ...props }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={props.meeting ? 'Edit meeting' : 'Record a meeting'}
      size="xl"
    >
      <MeetingForm onClose={onClose} {...props} />
    </Modal>
  );
}

function MeetingForm({ onClose, clientId, projectId, meeting }: Omit<Props, 'opened'>) {
  const navigate = useNavigate();
  const create = useCreateMeeting();
  const update = useUpdateMeeting(meeting?.id ?? '');
  const clients = useClients();
  const [values, setValues] = useState<Values>(() => ({
    clientId: meeting?.clientId ?? clientId ?? null,
    projectId: meeting?.projectId ?? projectId ?? null,
    title: meeting?.title ?? '',
    meetingDate: meeting?.meetingDate ?? todayIso(),
    attendees: meeting?.attendees ?? '',
    transcript: meeting?.transcript ?? '',
    minutes: meeting?.minutes ?? MINUTES_TEMPLATE,
  }));
  const projects = useProjects(values.clientId ?? undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadTranscript = async (file: File | null) => {
    if (!file) return;
    if (file.size > 500_000) {
      setErrors({ ...errors, transcript: 'The file is larger than 500 KB.' });
      return;
    }
    const text = await file.text();
    setValues((current) => ({ ...current, transcript: text }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (meeting) {
      const result = validate(updateMeetingSchema, {
        projectId: values.projectId,
        title: values.title,
        meetingDate: values.meetingDate,
        attendees: values.attendees,
        transcript: values.transcript,
        minutes: values.minutes,
      });
      if (result.errors) return setErrors(result.errors);
      update.mutate(result.data, {
        onSuccess: () => {
          showSuccess('Meeting saved');
          onClose();
        },
        onError: (error) => setErrors(apiErrors(error)),
      });
      return;
    }
    const result = validate(createMeetingSchema, values);
    if (result.errors) return setErrors(result.errors);
    create.mutate(result.data, {
      onSuccess: (created) => {
        showSuccess('Meeting recorded');
        onClose();
        void navigate(paths.meeting(created.id));
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
            data={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={values.clientId}
            onChange={(value) => setValues({ ...values, clientId: value, projectId: null })}
            disabled={Boolean(meeting || clientId)}
            error={errors.clientId}
            searchable
          />
          <Select
            label="Project"
            placeholder="Not tied to a project"
            data={(projects.data ?? []).map((p) => ({
              value: p.id,
              label: `${p.key} · ${p.name}`,
            }))}
            value={values.projectId}
            onChange={(value) => setValues({ ...values, projectId: value })}
            disabled={!values.clientId || Boolean(projectId && !meeting)}
            clearable
          />
        </SimpleGrid>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput
            label="Title"
            placeholder="Weekly sync with finance"
            style={{ gridColumn: 'span 2' }}
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.currentTarget.value })}
            error={errors.title}
          />
          <DateInput
            label="Date"
            valueFormat="D MMM YYYY"
            value={values.meetingDate}
            onChange={(value) => setValues({ ...values, meetingDate: value })}
            error={errors.meetingDate}
          />
        </SimpleGrid>
        <TextInput
          label="Attendees"
          placeholder="Priya (client), Arun, Meera"
          value={values.attendees}
          onChange={(e) => setValues({ ...values, attendees: e.currentTarget.value })}
        />
        <div>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>
              Transcript{' '}
              <Text span size="xs" c="dimmed">
                (internal — never shared with the client)
              </Text>
            </Text>
            <FileButton onChange={(file) => void loadTranscript(file)} accept={TRANSCRIPT_TYPES}>
              {(props) => (
                <Button
                  {...props}
                  size="compact-sm"
                  variant="light"
                  leftSection={<ActionIcons.import size={14} stroke={ICON_STROKE} />}
                >
                  Load from file
                </Button>
              )}
            </FileButton>
          </Group>
          <Textarea
            placeholder="Paste the transcript, or load a .txt / .vtt export from Teams or Zoom"
            autosize
            minRows={4}
            maxRows={12}
            value={values.transcript}
            onChange={(e) => setValues({ ...values, transcript: e.currentTarget.value })}
            error={errors.transcript}
            aria-label="Transcript"
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } }}
          />
        </div>
        <MarkdownEditor
          label="Minutes"
          value={values.minutes}
          onChange={(minutes) => setValues({ ...values, minutes })}
          minRows={6}
          error={errors.minutes}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {meeting ? 'Save' : 'Record meeting'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
