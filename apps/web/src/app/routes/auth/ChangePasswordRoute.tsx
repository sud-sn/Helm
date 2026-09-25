import { Alert, Button, PasswordInput, Stack, Text } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { PASSWORD_MIN_LENGTH, changePasswordSchema } from '@helm/shared';
import { homeFor } from '@/app/guards/RequireAuth';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { FullPageLoader } from '@/components/QueryState';
import { useChangePassword, useLogout, useMe } from '@/features/auth/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { paths } from '@/lib/paths';

/** First-login screen: replace the temporary password before anything else. */
export function ChangePasswordRoute() {
  const me = useMe();
  const change = useChangePassword();
  const logout = useLogout();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (me.isPending) return <FullPageLoader />;
  if (!me.data?.user) return <Navigate to={paths.login} replace />;
  const user = me.data.user;

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
      onSuccess: () => void navigate(homeFor(user.userType), { replace: true }),
    });
  };

  return (
    <AuthLayout
      title={user.mustChangePassword ? 'Choose your password' : 'Change password'}
      subtitle={
        user.mustChangePassword
          ? `Welcome, ${user.displayName}. Replace the temporary password you were given.`
          : undefined
      }
    >
      <form onSubmit={submit} noValidate>
        <Stack>
          {change.error ? (
            <Alert color="red" icon={<ActionIcons.warning size={18} stroke={ICON_STROKE} />}>
              {change.error.message}
            </Alert>
          ) : null}
          <PasswordInput
            label={user.mustChangePassword ? 'Temporary password' : 'Current password'}
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.currentTarget.value })}
            error={errors.currentPassword}
          />
          <PasswordInput
            label="New password"
            description={`At least ${PASSWORD_MIN_LENGTH} characters. A short phrase is easier to remember.`}
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
          <Button type="submit" loading={change.isPending} fullWidth mt="xs">
            Save password
          </Button>
          <Text ta="center" size="sm">
            <Button variant="subtle" size="compact-sm" onClick={() => logout.mutate()}>
              Sign out
            </Button>
          </Text>
        </Stack>
      </form>
    </AuthLayout>
  );
}
