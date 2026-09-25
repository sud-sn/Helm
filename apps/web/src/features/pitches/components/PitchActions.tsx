import { Alert, Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import {
  PITCH_EDITABLE_STATUSES,
  PITCH_FINAL_STATUSES,
  type Pitch,
  type PitchResponse,
} from '@helm/shared';
import { useCurrentUser } from '@/features/auth/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { showSuccess } from '@/lib/notify';
import { usePermissions } from '@/lib/permissions';
import { usePitchAction } from '../api';

type Dialog =
  { kind: 'return' } | { kind: 'respond'; response: PitchResponse; onBehalf: boolean } | null;

const RESPONSE_COPY: Record<PitchResponse, { title: string; button: string; color?: string }> = {
  accepted: { title: 'Accept this proposal', button: 'Accept' },
  changes_requested: { title: 'Ask for changes', button: 'Request changes', color: 'orange' },
  rejected: { title: 'Decline this proposal', button: 'Decline', color: 'red' },
};

/** The next steps available to the current user at the pitch's current stage. */
export function PitchActions({ pitch, onEdit }: { pitch: Pitch; onEdit: () => void }) {
  const user = useCurrentUser();
  const permissions = usePermissions({ clientId: pitch.clientId, projectId: pitch.projectId });
  const action = usePitchAction(pitch.id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState('');

  const clientView = user.userType === 'client';
  const editable = PITCH_EDITABLE_STATUSES.includes(pitch.status);
  const final = PITCH_FINAL_STATUSES.includes(pitch.status);
  const canWrite = permissions.has('pitch.write');
  const canApprove = permissions.has('pitch.approve');
  const canRespond = permissions.has('pitch.respond');

  const run = (input: Parameters<typeof action.mutate>[0], message: string) =>
    action.mutate(input, {
      onSuccess: () => {
        showSuccess(message);
        setDialog(null);
        setNote('');
      },
    });

  const buttons = [];
  if (!clientView && editable && canWrite) {
    buttons.push(
      <Button
        key="edit"
        variant="default"
        leftSection={<ActionIcons.edit size={16} stroke={ICON_STROKE} />}
        onClick={onEdit}
      >
        Edit
      </Button>,
      <Button
        key="submit"
        onClick={() => run({ type: 'submit' }, 'Sent for review')}
        loading={action.isPending}
      >
        Submit for review
      </Button>,
    );
  }
  if (!clientView && pitch.status === 'in_review' && canApprove) {
    buttons.push(
      <Button key="return" variant="default" onClick={() => setDialog({ kind: 'return' })}>
        Return to team
      </Button>,
      <Button
        key="send"
        leftSection={<ActionIcons.send size={16} stroke={ICON_STROKE} />}
        onClick={() =>
          run({ type: 'review', body: { decision: 'send', note: '' } }, 'Sent to the client')
        }
        loading={action.isPending}
      >
        Approve and send to client
      </Button>,
    );
  }
  if (pitch.status === 'sent' && (canRespond || (!clientView && canApprove))) {
    const onBehalf = !canRespond;
    buttons.push(
      <Button
        key="decline"
        variant="default"
        color="red"
        leftSection={<ActionIcons.reject size={16} stroke={ICON_STROKE} />}
        onClick={() => setDialog({ kind: 'respond', response: 'rejected', onBehalf })}
      >
        {onBehalf ? 'Record decline' : 'Decline'}
      </Button>,
      <Button
        key="changes"
        variant="default"
        leftSection={<ActionIcons.requestChanges size={16} stroke={ICON_STROKE} />}
        onClick={() => setDialog({ kind: 'respond', response: 'changes_requested', onBehalf })}
      >
        {onBehalf ? 'Record change request' : 'Request changes'}
      </Button>,
      <Button
        key="accept"
        color="green"
        leftSection={<ActionIcons.accept size={16} stroke={ICON_STROKE} />}
        onClick={() => setDialog({ kind: 'respond', response: 'accepted', onBehalf })}
      >
        {onBehalf ? 'Record acceptance' : 'Accept'}
      </Button>,
    );
  }
  if (!clientView && !final && canApprove) {
    buttons.push(
      <Button
        key="withdraw"
        variant="subtle"
        color="gray"
        onClick={() => run({ type: 'withdraw' }, 'Pitch withdrawn')}
      >
        Withdraw
      </Button>,
    );
  }

  const respondCopy = dialog?.kind === 'respond' ? RESPONSE_COPY[dialog.response] : null;

  return (
    <>
      {buttons.length > 0 ? <Group gap="xs">{buttons}</Group> : null}
      <Modal
        opened={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog?.kind === 'return' ? 'Return to the team' : respondCopy?.title}
      >
        <Stack>
          {action.error ? <Alert color="red">{action.error.message}</Alert> : null}
          {dialog?.kind === 'respond' && dialog.onBehalf ? (
            <Alert color="brass" icon={<ActionIcons.info size={18} stroke={ICON_STROKE} />}>
              You are recording an answer the client gave outside the portal. It is marked as
              recorded on their behalf.
            </Alert>
          ) : null}
          <Textarea
            label={dialog?.kind === 'return' ? 'What needs to change?' : 'Note (optional)'}
            autosize
            minRows={3}
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          {dialog?.kind === 'respond' && !dialog.onBehalf ? (
            <Text size="xs" c="dimmed">
              The team is notified of your answer.
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDialog(null)}>
              Cancel
            </Button>
            {dialog?.kind === 'return' ? (
              <Button
                loading={action.isPending}
                onClick={() =>
                  run(
                    { type: 'review', body: { decision: 'return', note } },
                    'Returned to the team',
                  )
                }
              >
                Return
              </Button>
            ) : dialog?.kind === 'respond' ? (
              <Button
                color={respondCopy?.color}
                loading={action.isPending}
                onClick={() =>
                  run(
                    { type: 'respond', body: { response: dialog.response, note } },
                    'Response recorded',
                  )
                }
              >
                {respondCopy?.button}
              </Button>
            ) : null}
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
