import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  DOC_TYPE_DESCRIPTIONS,
  DOC_TYPE_LABELS,
  DOC_TYPES,
  createPageSchema,
  draftPageSchema,
  type DocType,
} from '@helm/shared';
import { useFeatures } from '@/features/ai/api';
import { useCycles } from '@/features/cycles/api';
import { useMeetings } from '@/features/meetings/api';
import { useProject } from '@/features/projects/api';
import { useTickets } from '@/features/tickets/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { apiErrors, validate } from '@/lib/forms';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { useCreatePage, useDraftPage, useProjectPages } from '../api';

const DOC_TEMPLATE = `## Purpose\n\n## Source\n\n## Target\n\n## Transformations\n\n## Schedule and dependencies\n\n## Data quality checks\n\n## Runbook\n`;

const BRIEF_PLACEHOLDERS: Record<DocType, string> = {
  technical_spec:
    'What it does and why, the sources and targets, key tables and business rules, when it ' +
    'runs, how errors are handled and how it was tested. Write it the way you would explain ' +
    'it to a colleague.',
  delivery_document:
    'What this cycle or release delivered, where and when it was deployed, how it was tested ' +
    "and accepted, known issues, and what's next.",
};

type Mode = 'blank' | 'ai';

/** Starts a page (optionally linked to a ticket) and opens the editor, or has the AI write it. */
interface Props {
  opened: boolean;
  onClose: () => void;
  projectKey: string;
  ticketId?: string;
  defaultTitle?: string;
}

export function NewPageModal({ opened, onClose, ...props }: Props) {
  // While the AI writes (a minute or two) the window stays open, so the result is not lost.
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="New page"
      size="lg"
      closeOnClickOutside={!busy}
      closeOnEscape={!busy}
      withCloseButton={!busy}
    >
      <NewPageForm onClose={onClose} onBusyChange={setBusy} {...props} />
    </Modal>
  );
}

function NewPageForm({
  onClose,
  onBusyChange,
  projectKey,
  ticketId,
  defaultTitle = '',
}: Omit<Props, 'opened'> & { onBusyChange: (busy: boolean) => void }) {
  const features = useFeatures();
  // Drafts are project documents; a page started from a ticket stays a plain page.
  const aiAvailable = features.data?.ai === true && !ticketId;
  const [mode, setMode] = useState<Mode>('blank');

  return (
    <Stack>
      {aiAvailable ? (
        <SegmentedControl
          fullWidth
          value={mode}
          onChange={(value) => setMode(value as Mode)}
          data={[
            { value: 'blank', label: 'Blank page' },
            { value: 'ai', label: 'Write with AI' },
          ]}
        />
      ) : null}
      {aiAvailable && mode === 'ai' ? (
        <DraftForm
          projectKey={projectKey}
          defaultTitle={defaultTitle}
          onClose={onClose}
          onBusyChange={onBusyChange}
        />
      ) : (
        <BlankForm
          projectKey={projectKey}
          ticketId={ticketId}
          defaultTitle={defaultTitle}
          onClose={onClose}
        />
      )}
    </Stack>
  );
}

function BlankForm({
  onClose,
  projectKey,
  ticketId,
  defaultTitle,
}: {
  onClose: () => void;
  projectKey: string;
  ticketId?: string;
  defaultTitle: string;
}) {
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

/**
 * The developer describes the work in plain words and picks what else the AI may read; the AI
 * writes the document in the fixed sections of its type, as an internal page to review.
 */
function DraftForm({
  onClose,
  onBusyChange,
  projectKey,
  defaultTitle,
}: {
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  projectKey: string;
  defaultTitle: string;
}) {
  const navigate = useNavigate();
  const draft = useDraftPage(projectKey);
  const project = useProject(projectKey);
  const cycles = useCycles(projectKey);
  const tickets = useTickets(projectKey);
  const meetings = useMeetings({ projectId: project.data?.id });
  const pages = useProjectPages(projectKey);
  const [docType, setDocType] = useState<DocType>('technical_spec');
  const [title, setTitle] = useState(defaultTitle);
  const [brief, setBrief] = useState('');
  // undefined until the person picks: then a delivery document follows the cycle in progress.
  const [cycleChoice, setCycleChoice] = useState<string | null | undefined>(undefined);
  const [ticketKeys, setTicketKeys] = useState<string[]>([]);
  const [meetingIds, setMeetingIds] = useState<string[]>([]);
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = draft.isPending;
  const activeCycleId = cycles.data?.find((cycle) => cycle.status === 'active')?.id ?? null;
  // A delivery document is usually about the cycle in progress.
  const cycleId =
    cycleChoice !== undefined
      ? cycleChoice
      : docType === 'delivery_document'
        ? activeCycleId
        : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(draftPageSchema, {
      docType,
      title,
      brief,
      cycleId,
      ticketKeys,
      meetingIds,
      pageIds,
    });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    onBusyChange(true);
    draft.mutate(result.data, {
      onSuccess: ({ page }) => {
        onBusyChange(false);
        onClose();
        showSuccess('Review it, fill in the gaps, then share it.', 'Draft ready');
        void navigate(paths.page(page.id));
      },
      onError: (error) => {
        onBusyChange(false);
        setErrors(apiErrors(error));
      },
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        <Stack gap={6}>
          <SegmentedControl
            fullWidth
            value={docType}
            disabled={busy}
            onChange={(value) => setDocType(value as DocType)}
            data={DOC_TYPES.map((value) => ({ value, label: DOC_TYPE_LABELS[value] }))}
          />
          <Text size="xs" c="dimmed">
            {DOC_TYPE_DESCRIPTIONS[docType]}
          </Text>
        </Stack>
        <TextInput
          label="Title"
          description="Leave it empty and the AI suggests one"
          placeholder="Sales mart nightly load"
          value={title}
          disabled={busy}
          onChange={(e) => setTitle(e.currentTarget.value)}
          error={errors.title}
        />
        <Textarea
          label="Describe it in your own words"
          placeholder={BRIEF_PLACEHOLDERS[docType]}
          autosize
          minRows={6}
          maxRows={14}
          required
          data-autofocus
          value={brief}
          disabled={busy}
          onChange={(e) => setBrief(e.currentTarget.value)}
          error={errors.brief}
        />
        <Text size="sm" fw={600} mb={-8}>
          Also use (optional)
        </Text>
        <Select
          label="A cycle and its tickets"
          placeholder="None"
          clearable
          data={(cycles.data ?? []).map((cycle) => ({ value: cycle.id, label: cycle.name }))}
          value={cycleId}
          disabled={busy}
          onChange={setCycleChoice}
          error={errors.cycleId}
        />
        <MultiSelect
          label="Tickets"
          placeholder={ticketKeys.length ? undefined : 'None'}
          searchable
          maxValues={30}
          data={(tickets.data ?? []).map((ticket) => ({
            value: ticket.key,
            label: `${ticket.key} ${ticket.title}`,
          }))}
          value={ticketKeys}
          disabled={busy}
          onChange={setTicketKeys}
          error={errors.ticketKeys}
        />
        <Group grow align="flex-start">
          <MultiSelect
            label="Meetings"
            placeholder={meetingIds.length ? undefined : 'None'}
            searchable
            maxValues={5}
            data={(meetings.data ?? [])
              .filter((meeting) => meeting.projectId === project.data?.id)
              .map((meeting) => ({
                value: meeting.id,
                label: `${meeting.title} (${meeting.meetingDate})`,
              }))}
            value={meetingIds}
            disabled={busy}
            onChange={setMeetingIds}
            error={errors.meetingIds}
          />
          <MultiSelect
            label="Pages"
            placeholder={pageIds.length ? undefined : 'None'}
            searchable
            maxValues={5}
            data={(pages.data ?? []).map((page) => ({ value: page.id, label: page.title }))}
            value={pageIds}
            disabled={busy}
            onChange={setPageIds}
            error={errors.pageIds}
          />
        </Group>
        {errors.form ? <Alert color="red">{errors.form}</Alert> : null}
        {busy ? (
          <Alert color="violet" icon={<Loader size={16} color="violet" />}>
            Writing the {DOC_TYPE_LABELS[docType].toLowerCase()}. This usually takes one to two
            minutes; keep this window open.
          </Alert>
        ) : (
          <Text size="xs" c="dimmed">
            Your notes and what you pick are sent to your company’s Azure OpenAI. The draft is saved
            as an internal page for you to review; it is not shared with the client.
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={busy}
            leftSection={<ActionIcons.suggest size={16} stroke={ICON_STROKE} />}
          >
            Write draft
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
