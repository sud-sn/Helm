import {
  Alert,
  Anchor,
  Button,
  FileInput,
  Group,
  List,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { useState } from 'react';
import type { ImportResult } from '@helm/shared';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { showSuccess } from '@/lib/notify';
import { useImportTickets } from '../api';

const TEMPLATE = [
  'title,description,type,status,priority,assignee,cycle,due_date,estimate_hours,labels',
  'Load SAP orders into staging,Daily delta load,pipeline,todo,high,priya,Sprint 1,2026-10-31,8,"sap, orders"',
].join('\r\n');

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([`\uFEFF${TEMPLATE}\r\n`], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'helm-ticket-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

/** Bring an existing Excel tracker across: check every row first, then import all at once. */
export function ImportTicketsModal({
  opened,
  onClose,
  projectKey,
}: {
  opened: boolean;
  onClose: () => void;
  projectKey: string;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Import tickets from CSV" size="lg">
      <ImportTicketsForm onClose={onClose} projectKey={projectKey} />
    </Modal>
  );
}

function ImportTicketsForm({ onClose, projectKey }: { onClose: () => void; projectKey: string }) {
  const importer = useImportTickets(projectKey);
  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  const check = async (chosen: File | null) => {
    setFile(chosen);
    setResult(null);
    if (!chosen) return;
    const text = await chosen.text();
    setCsv(text);
    importer.mutate({ csv: text, dryRun: true }, { onSuccess: setResult });
  };

  const run = () =>
    importer.mutate(
      { csv, dryRun: false },
      {
        onSuccess: (done) => {
          showSuccess(`Imported ${done.created} tickets into ${projectKey}`);
          onClose();
        },
      },
    );

  const problems = result?.rows.filter((row) => row.errors.length > 0) ?? [];

  return (
    <Stack>
      <Text size="sm">
        In Excel choose <b>File › Save As › CSV UTF-8</b>. The first row must be a header with at
        least a <b>title</b> column. Common tracker headings such as Summary, State, Owner, Due or
        Sprint are recognised.
      </Text>
      <List size="sm" spacing={2}>
        <List.Item>Dates: YYYY-MM-DD or day-first DD/MM/YYYY</List.Item>
        <List.Item>Assignee: username or email of someone with access to the project</List.Item>
        <List.Item>Cycle: the name of an existing cycle, or empty for the backlog</List.Item>
      </List>
      <Anchor component="button" type="button" size="sm" onClick={downloadTemplate}>
        Download a template
      </Anchor>
      <FileInput
        label="CSV file"
        placeholder="Choose a .csv file"
        accept=".csv,text/csv"
        value={file}
        onChange={(chosen) => void check(chosen)}
        leftSection={<ActionIcons.import size={16} stroke={ICON_STROKE} />}
        clearable
      />
      {importer.error ? <Alert color="red">{importer.error.message}</Alert> : null}
      {result ? (
        result.valid ? (
          <Alert color="green" title="Ready to import">
            All {result.totalRows} rows are valid. Nothing has been imported yet.
          </Alert>
        ) : (
          <Alert
            color="orange"
            title={`${problems.length} of ${result.totalRows} rows need fixing`}
          >
            Fix these rows in the file and choose it again. Nothing was imported.
          </Alert>
        )
      ) : null}
      {problems.length > 0 ? (
        <ScrollArea.Autosize mah={260}>
          <Table verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>Row</Table.Th>
                <Table.Th>Problem</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {problems.map((row) => (
                <Table.Tr key={row.row}>
                  <Table.Td>{row.row}</Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {row.title || '(no title)'}
                    </Text>
                    <Text size="xs" c="red.7">
                      {row.errors.join(' ')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      ) : null}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={run}
          disabled={!result?.valid}
          loading={importer.isPending && Boolean(result)}
        >
          Import {result?.valid ? `${result.totalRows} tickets` : ''}
        </Button>
      </Group>
    </Stack>
  );
}
