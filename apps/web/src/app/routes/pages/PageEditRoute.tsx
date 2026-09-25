import { Alert, Button, Card, Stack, TextInput } from '@mantine/core';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Page } from '@helm/shared';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { PageHeader } from '@/components/PageHeader';
import { QueryState } from '@/components/QueryState';
import { usePage, useUpdatePage } from '@/features/pages/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { ApiError } from '@/lib/api-client';
import { showSuccess } from '@/lib/notify';
import { paths } from '@/lib/paths';

export function PageEditRoute() {
  const { pageId = '' } = useParams();
  const page = usePage(pageId);
  return (
    <QueryState query={page}>
      {(data) => (
        <PageEditor
          key={`${data.id}:${data.version}`}
          page={data}
          onReload={() => void page.refetch()}
        />
      )}
    </QueryState>
  );
}

/**
 * Edits a page from the version it was opened at. Saving sends that version; if someone else saved
 * in between, the API refuses and the editor offers to load the latest version (remounting it).
 */
function PageEditor({ page, onReload }: { page: Page; onReload: () => void }) {
  const save = useUpdatePage(page.id);
  const navigate = useNavigate();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const conflict = save.error instanceof ApiError && save.error.code === 'VERSION_CONFLICT';

  return (
    <>
      <PageHeader
        crumbs={[
          { label: page.projectKey, to: paths.project(page.projectKey, 'pages') },
          { label: page.title, to: paths.page(page.id) },
          { label: 'Edit' },
        ]}
        title="Edit page"
        description={`Editing version ${page.version}`}
        actions={
          <>
            <Button variant="default" onClick={() => void navigate(paths.page(page.id))}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              leftSection={<ActionIcons.check size={16} stroke={ICON_STROKE} />}
              onClick={() =>
                save.mutate(
                  { title, body, expectedVersion: page.version },
                  {
                    onSuccess: (saved) => {
                      showSuccess(`Saved version ${saved.version}`);
                      void navigate(paths.page(saved.id));
                    },
                  },
                )
              }
            >
              Save
            </Button>
          </>
        }
      />
      <Stack gap="md">
        {conflict ? (
          <Alert color="orange" title="Someone else saved this page while you were editing">
            Copy your changes somewhere safe, then{' '}
            <Button variant="subtle" size="compact-sm" onClick={onReload}>
              load the latest version
            </Button>{' '}
            and apply them again.
          </Alert>
        ) : save.error ? (
          <Alert color="red">{save.error.message}</Alert>
        ) : null}
        <Card>
          <Stack>
            <TextInput
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
            />
            <MarkdownEditor value={body} onChange={setBody} minRows={18} />
          </Stack>
        </Card>
      </Stack>
    </>
  );
}
