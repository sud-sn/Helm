import { Alert, Button, Code, CopyButton, Group, Modal, Stack, Text } from '@mantine/core';
import type { TemporaryPasswordResponse } from '@helm/shared';
import { ActionIcons, ICON_STROKE } from '@/icons';

/** Shows a generated password exactly once. */
export function TemporaryPasswordModal({
  result,
  onClose,
}: {
  result: TemporaryPasswordResponse | null;
  onClose: () => void;
}) {
  return (
    <Modal opened={Boolean(result)} onClose={onClose} title="Account ready">
      {result ? (
        <Stack>
          <Text size="sm">
            <b>{result.user.displayName}</b> can sign in as <Code>{result.user.username}</Code>.
          </Text>
          {result.temporaryPassword ? (
            <>
              <Alert
                color="orange"
                icon={<ActionIcons.key size={18} stroke={ICON_STROKE} />}
                title="Temporary password — shown only once"
              >
                <Group justify="space-between" wrap="nowrap">
                  <Code fz="lg" fw={600}>
                    {result.temporaryPassword}
                  </Code>
                  <CopyButton value={result.temporaryPassword}>
                    {({ copied, copy }) => (
                      <Button size="xs" variant="light" onClick={copy}>
                        {copied ? 'Copied' : 'Copy'}
                      </Button>
                    )}
                  </CopyButton>
                </Group>
              </Alert>
              <Text size="sm" c="dimmed">
                Share it privately (not in a group chat). They will choose their own password at
                first sign-in.
              </Text>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              They will be asked to change the password you set when they first sign in.
            </Text>
          )}
          <Group justify="flex-end">
            <Button onClick={onClose}>Done</Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  );
}
