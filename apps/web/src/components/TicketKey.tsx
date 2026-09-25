import { Anchor, Text } from '@mantine/core';
import { Link } from 'react-router';

/** A ticket key such as ACME-12: monospace, never broken across lines. */
export function TicketKey({ ticketKey, link = true }: { ticketKey: string; link?: boolean }) {
  const content = (
    <Text
      component="span"
      ff="monospace"
      size="xs"
      c="dimmed"
      fw={500}
      style={{ whiteSpace: 'nowrap' }}
    >
      {ticketKey}
    </Text>
  );
  return link ? (
    <Anchor
      component={Link}
      to={`/tickets/${ticketKey}`}
      underline="hover"
      style={{ flex: 'none' }}
    >
      {content}
    </Anchor>
  ) : (
    content
  );
}
