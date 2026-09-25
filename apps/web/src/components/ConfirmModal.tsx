import { Button, Group, Modal, Text } from '@mantine/core';
import type { ReactNode } from 'react';

export function ConfirmModal({
  opened,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel,
  danger = false,
  loading = false,
}: {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={600}>{title}</Text>} size="sm">
      <Text size="sm">{children}</Text>
      <Group justify="flex-end" mt="lg">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button color={danger ? 'red' : undefined} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
