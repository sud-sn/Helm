import {
  Alert,
  Button,
  Card,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { PASSWORD_MIN_LENGTH, changePasswordSchema } from '@helm/shared';
import { RoleTag } from '@/components/domain-tags';
import { PageHeader } from '@/components/PageHeader';
import { useChangePassword, useCurrentUser } from '@/features/auth/api';
import { showSuccess } from '@/lib/notify';

export function AccountRoute() {
  const user = useCurrentUser();
  const change = useChangePassword();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: Record<string, string> = {};
    const parsed = changePasswordSchema.safeParse(form);
    if (!parsed.success)
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
    if (form.newPassword !== form.confirm) next.confirm = 'The passwords do not match';
    setErrors(next);
    if (Object.keys(next).length > 0 || !parsed.success) return;
    change.mutate(parsed.data, {
      onSuccess: () => {
        setForm({ currentPassword: '', newPassword: '', confirm: '' });
        showSuccess('Password changed. Other devices were signed out.');
      },
    });
  };

  return (
    <>
      <PageHeader title="Account" />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Card>
          <Title order={3} mb="md">
            Profile
          </Title>
          <Stack gap="xs">
            <Text>
              <Text span c="dimmed">
                Name:{' '}
              </Text>
              {user.displayName}
            </Text>
            <Text>
              <Text span c="dimmed">
                Username:{' '}
              </Text>
              @{user.username}
            </Text>
            <Text>
              <Text span c="dimmed">
                Email:{' '}
              </Text>
              {user.email ?? '—'}
            </Text>
            <Group gap={6}>
              {[...new Set(user.grants.map((grant) => grant.role))].map((role) => (
                <RoleTag key={role} role={role} />
              ))}
            </Group>
            <Text size="xs" c="dimmed" mt="sm">
              Your name, email and access are managed by your administrator.
            </Text>
          </Stack>
        </Card>
        <Card>
          <Title order={3} mb="md">
            Change password
          </Title>
          <form onSubmit={submit} noValidate>
            <Stack>
              {change.error ? <Alert color="red">{change.error.message}</Alert> : null}
              <PasswordInput
                label="Current password"
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.currentTarget.value })}
                error={errors.currentPassword}
              />
              <PasswordInput
                label="New password"
                description={`At least ${PASSWORD_MIN_LENGTH} characters.`}
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.currentTarget.value })}
                error={errors.newPassword}
              />
              <PasswordInput
                label="Confirm new password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.currentTarget.value })}
                error={errors.confirm}
              />
              <Group justify="flex-end">
                <Button type="submit" loading={change.isPending}>
                  Change password
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </SimpleGrid>
    </>
  );
}
