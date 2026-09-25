import { Button, Group, Text, Title } from '@mantine/core';
import { useEffect, useLayoutEffect } from 'react';
import { useParams } from 'react-router';
import { DOC_TYPE_LABELS, type Page } from '@helm/shared';
import { Markdown } from '@/components/Markdown';
import { QueryState } from '@/components/QueryState';
import { usePage } from '@/features/pages/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { formatDate } from '@/lib/format';
import classes from './PagePrintRoute.module.css';

const printDetails = (page: Page) =>
  [
    page.docType ? DOC_TYPE_LABELS[page.docType] : null,
    `${page.clientName} · ${page.projectName} (${page.projectKey})`,
    `Version ${page.version}`,
    formatDate(page.updatedAt),
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Paper is white: the print view always uses the light colours, whatever the person picked,
 * without changing their saved choice. Put back when they leave.
 */
function useLightScheme() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-mantine-color-scheme');
    root.setAttribute('data-mantine-color-scheme', 'light');
    return () => {
      if (previous) root.setAttribute('data-mantine-color-scheme', previous);
    };
  }, []);
}

/**
 * A page on its own, for printing or saving as PDF: the browser's PDF engine keeps every
 * character, table and code block exactly as Helm shows them. The print window opens by itself
 * once the page and its fonts have loaded; the title becomes the PDF's suggested file name.
 */
export function PagePrintRoute() {
  const { pageId = '' } = useParams();
  const page = usePage(pageId);
  useLightScheme();
  const title = page.data?.title;

  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    let cancelled = false;
    let timer: number | undefined;
    void document.fonts.ready.then(() => {
      timer = window.setTimeout(() => {
        if (!cancelled) window.print();
      }, 300);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.title = previous;
    };
  }, [title]);

  return (
    <QueryState query={page}>
      {(data) => (
        <>
          <div className={classes.toolbar}>
            <Text size="sm" c="dimmed">
              To keep a PDF, choose <b>Save as PDF</b> as the printer in the print window.
            </Text>
            <Group gap="xs">
              <Button
                leftSection={<ActionIcons.print size={16} stroke={ICON_STROKE} />}
                onClick={() => window.print()}
              >
                Print or save as PDF
              </Button>
            </Group>
          </div>
          <article className={classes.document}>
            <Title order={1}>{data.title}</Title>
            <Text size="sm" c="dimmed" className={classes.meta}>
              {printDetails(data)}
            </Text>
            {data.body.trim() ? (
              <Markdown>{data.body}</Markdown>
            ) : (
              <Text c="dimmed">This page is empty.</Text>
            )}
          </article>
        </>
      )}
    </QueryState>
  );
}
