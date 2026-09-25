import {
  Alert,
  Button,
  Card,
  Drawer,
  Group,
  Stack,
  Switch,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DOC_TYPE_LABELS } from '@helm/shared';
import { ConfirmModal } from '@/components/ConfirmModal';
import { VisibilityTag } from '@/components/domain-tags';
import { Markdown } from '@/components/Markdown';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { Tag } from '@/components/Tag';
import { useCurrentUser } from '@/features/auth/api';
import {
  pageWordUrl,
  useDeletePage,
  usePage,
  usePageVersions,
  useSetPageVisibility,
} from '@/features/pages/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { formatDateTime, fromNow } from '@/lib/format';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';
import { usePermissions } from '@/lib/permissions';

/** A documentation page: staff at /pages/:id, clients (shared pages only) at /portal/pages/:id. */
export function PageRoute() {
  const { pageId = '' } = useParams();
  const user = useCurrentUser();
  const clientView = user.userType === 'client';
  const page = usePage(pageId);
  const permissions = usePermissions(
    page.data ? { clientId: page.data.clientId, projectId: page.data.projectId } : null,
  );
  const [historyOpen, history] = useDisclosure(false);
  const versions = usePageVersions(pageId, historyOpen && !clientView);
  const [viewing, setViewing] = useState<number | null>(null);
  const share = useSetPageVisibility(pageId);
  const remove = useDeletePage();
  const navigate = useNavigate();
  const [deleting, del] = useDisclosure(false);
  const shown = viewing !== null ? versions.data?.find((v) => v.version === viewing) : null;

  return (
    <QueryState query={page}>
      {(data) => (
        <>
          <PageHeader
            crumbs={
              clientView
                ? [{ label: 'Home', to: paths.portal.home }, { label: 'Documents' }]
                : [
                    { label: data.projectKey, to: paths.project(data.projectKey, 'pages') },
                    { label: 'Pages', to: paths.project(data.projectKey, 'pages') },
                    { label: data.title },
                  ]
            }
            title={data.title}
            meta={
              !clientView ? (
                <Group gap={6}>
                  <VisibilityTag visibility={data.visibility} />
                  {data.aiDrafted ? (
                    <Tag tone="review" icon={ActionIcons.suggest}>
                      AI draft
                    </Tag>
                  ) : null}
                </Group>
              ) : undefined
            }
            description={`${data.docType ? `${DOC_TYPE_LABELS[data.docType]} · ` : ''}Version ${data.version} · updated ${fromNow(data.updatedAt)} by ${data.updatedBy.displayName}${
              data.ticketKey ? ` · ${data.ticketKey}` : ''
            }`}
            actions={
              <>
                <Tooltip label="Download as a Word document">
                  <Button
                    component="a"
                    href={pageWordUrl(data.id)}
                    variant="default"
                    leftSection={<ActionIcons.downloadWord size={16} stroke={ICON_STROKE} />}
                  >
                    Word
                  </Button>
                </Tooltip>
                <Tooltip label="Opens a print view: choose Save as PDF">
                  <Button
                    component="a"
                    href={paths.pagePrint(data.id)}
                    target="_blank"
                    rel="noopener"
                    variant="default"
                    leftSection={<ActionIcons.downloadPdf size={16} stroke={ICON_STROKE} />}
                  >
                    PDF
                  </Button>
                </Tooltip>
                {clientView ? null : (
                  <>
                    {permissions.has('content.share') ? (
                      <Tooltip label="Shared pages appear in the client portal">
                        <Switch
                          label="Share with client"
                          // Show the new position while saving; it falls back if the request fails.
                          checked={
                            (share.isPending ? share.variables : data.visibility) === 'client'
                          }
                          disabled={share.isPending}
                          onChange={(e) =>
                            share.mutate(e.currentTarget.checked ? 'client' : 'internal', {
                              onSuccess: (updated) =>
                                showSuccess(
                                  updated.visibility === 'client'
                                    ? 'Shared with the client'
                                    : 'Page is internal again',
                                ),
                            })
                          }
                        />
                      </Tooltip>
                    ) : null}
                    <Button
                      variant="default"
                      leftSection={<ActionIcons.history size={16} stroke={ICON_STROKE} />}
                      onClick={history.open}
                    >
                      History
                    </Button>
                    {permissions.has('page.write') ? (
                      <Button
                        component={Link}
                        to={paths.pageEdit(data.id)}
                        leftSection={<ActionIcons.edit size={16} stroke={ICON_STROKE} />}
                      >
                        Edit
                      </Button>
                    ) : null}
                    {permissions.has('page.delete') ? (
                      <Button variant="subtle" color="red" onClick={del.open}>
                        Delete
                      </Button>
                    ) : null}
                  </>
                )}
              </>
            }
          />
          {!clientView && data.aiDrafted && data.version === 1 ? (
            <Alert
              mb="md"
              color="violet"
              icon={<ActionIcons.suggest size={18} stroke={ICON_STROKE} />}
              title="Written by AI from notes: review it before sharing"
            >
              Check every fact against the notes, fill in the lines marked “To confirm”, and tick
              off the open questions at the end. The page stays internal until someone shares it.
            </Alert>
          ) : null}
          <Card>
            {data.body.trim() ? (
              <Markdown>{data.body}</Markdown>
            ) : (
              <Text c="dimmed">This page is empty.</Text>
            )}
          </Card>
          <Drawer
            opened={historyOpen}
            onClose={history.close}
            title="Version history"
            position="right"
            size="lg"
          >
            <QueryState query={versions}>
              {(list) => (
                <Stack gap="xs">
                  {list.map((version) => (
                    <UnstyledButton
                      key={version.version}
                      onClick={() =>
                        setViewing(version.version === viewing ? null : version.version)
                      }
                      p="xs"
                      style={{
                        borderRadius: 8,
                        border: '1px solid var(--mantine-color-default-border)',
                        background:
                          version.version === viewing
                            ? 'var(--mantine-primary-color-light)'
                            : undefined,
                      }}
                    >
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>
                          Version {version.version}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatDateTime(version.createdAt)} · {version.createdBy.displayName}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  ))}
                  {shown ? (
                    <Card mt="sm">
                      <Text fw={600} mb="xs">
                        {shown.title}
                      </Text>
                      <Markdown>{shown.body}</Markdown>
                    </Card>
                  ) : null}
                </Stack>
              )}
            </QueryState>
          </Drawer>
          <ConfirmModal
            opened={deleting}
            onClose={del.close}
            title="Delete this page?"
            confirmLabel="Delete page"
            danger
            loading={remove.isPending}
            onConfirm={() =>
              remove.mutate(data.id, {
                onSuccess: () => {
                  showSuccess('Page deleted');
                  void navigate(paths.project(data.projectKey, 'pages'));
                },
              })
            }
          >
            The page and all its versions are removed.
          </ConfirmModal>
        </>
      )}
    </QueryState>
  );
}
