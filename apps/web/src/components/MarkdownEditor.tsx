import { Paper, Tabs, Text, Textarea } from '@mantine/core';
import { useState } from 'react';
import { Markdown } from './Markdown';

/** Write/preview Markdown editor. */
export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
  minRows = 8,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minRows?: number;
  error?: string;
}) {
  const [tab, setTab] = useState<string | null>('write');
  return (
    <div>
      {label ? (
        <Text size="sm" fw={500} mb={4}>
          {label}
        </Text>
      ) : null}
      <Tabs value={tab} onChange={setTab} variant="outline">
        <Tabs.List>
          <Tabs.Tab value="write">Write</Tabs.Tab>
          <Tabs.Tab value="preview">Preview</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="write" pt="xs">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder={placeholder ?? 'Markdown supported: **bold**, lists, tables, `code`'}
            autosize
            minRows={minRows}
            maxRows={30}
            error={error}
            aria-label={label ?? 'Content'}
            styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 13 } }}
          />
        </Tabs.Panel>
        <Tabs.Panel value="preview" pt="xs">
          <Paper withBorder p="md" mih={120}>
            {value.trim() ? (
              <Markdown>{value}</Markdown>
            ) : (
              <Text c="dimmed">Nothing to preview yet.</Text>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
