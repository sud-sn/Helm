import { Anchor, Card, Group, Table, Text } from '@mantine/core';
import { Link } from 'react-router';
import type { PageSummary } from '@helm/shared';
import { VisibilityTag } from '@/components/domain-tags';
import { Tag } from '@/components/Tag';
import { TicketKey } from '@/components/TicketKey';
import { ActionIcons } from '@/icons';
import { fromNow } from '@/lib/format';

export function PageList({
  pages,
  pagePath,
  showVisibility = true,
}: {
  pages: PageSummary[];
  pagePath: (id: string) => string;
  showVisibility?: boolean;
}) {
  return (
    <Card p={0}>
      <Table.ScrollContainer minWidth={600}>
        <Table verticalSpacing="sm" horizontalSpacing="md" highlightOnHover>
          <Table.Tbody>
            {pages.map((page) => (
              <Table.Tr key={page.id}>
                <Table.Td>
                  <Anchor component={Link} to={pagePath(page.id)} fw={600} size="sm">
                    {page.title}
                  </Anchor>
                  <Group gap={6}>
                    <Text size="xs" c="dimmed">
                      v{page.version} · updated {fromNow(page.updatedAt)} by{' '}
                      {page.updatedBy.displayName}
                    </Text>
                    {page.ticketKey ? (
                      <TicketKey ticketKey={page.ticketKey} link={showVisibility} />
                    ) : null}
                    {showVisibility && page.aiDrafted ? (
                      <Tag tone="review" icon={ActionIcons.suggest}>
                        AI draft
                      </Tag>
                    ) : null}
                  </Group>
                </Table.Td>
                {showVisibility ? (
                  <Table.Td w={180}>
                    <VisibilityTag visibility={page.visibility} />
                  </Table.Td>
                ) : null}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}
