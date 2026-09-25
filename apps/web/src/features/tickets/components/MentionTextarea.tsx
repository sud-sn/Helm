import { Paper, Stack, Text, Textarea, UnstyledButton } from '@mantine/core';
import { useRef, useState, type KeyboardEvent } from 'react';
import type { UserSummary } from '@helm/shared';

const TOKEN = /(^|[^A-Za-z0-9_@.])@([A-Za-z0-9._-]*)$/;

/**
 * A textarea that suggests people when you type "@". Only people who can see the ticket are
 * offered (the API ignores anyone else anyway and reports them back).
 */
export function MentionTextarea({
  value,
  onChange,
  people,
  placeholder,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  people: UserSummary[];
  placeholder?: string;
  onSubmit?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches =
    query === null
      ? []
      : people
          .filter(
            (person) =>
              person.username.startsWith(query.toLowerCase()) ||
              person.displayName.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 6);

  const refreshQuery = (text: string, caret: number) => {
    const match = TOKEN.exec(text.slice(0, caret));
    setQuery(match ? (match[2] ?? '') : null);
    setHighlight(0);
  };

  const insert = (person: UserSummary) => {
    const element = ref.current;
    if (!element) return;
    const caret = element.selectionStart;
    const before = value.slice(0, caret).replace(/@([A-Za-z0-9._-]*)$/, `@${person.username} `);
    const next = before + value.slice(caret);
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(before.length, before.length);
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (matches.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insert(matches[highlight]!);
        return;
      }
      if (event.key === 'Escape') {
        setQuery(null);
        return;
      }
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <Textarea
        ref={ref}
        value={value}
        placeholder={placeholder}
        autosize
        minRows={3}
        maxRows={14}
        aria-label="Comment"
        onChange={(event) => {
          onChange(event.currentTarget.value);
          refreshQuery(event.currentTarget.value, event.currentTarget.selectionStart);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {matches.length > 0 ? (
        <Paper
          shadow="md"
          withBorder
          p={4}
          style={{ position: 'absolute', zIndex: 10, left: 8, top: '100%', minWidth: 240 }}
          role="listbox"
        >
          <Stack gap={0}>
            {matches.map((person, index) => (
              <UnstyledButton
                key={person.id}
                role="option"
                aria-selected={index === highlight}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insert(person);
                }}
                px="xs"
                py={6}
                style={{
                  borderRadius: 6,
                  background:
                    index === highlight ? 'var(--mantine-primary-color-light)' : undefined,
                }}
              >
                <Text size="sm">
                  {person.displayName}{' '}
                  <Text span c="dimmed" size="xs">
                    @{person.username}
                  </Text>
                </Text>
              </UnstyledButton>
            ))}
          </Stack>
        </Paper>
      ) : null}
    </div>
  );
}
