import { Alert, Button, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { loginSchema } from '@helm/shared';
import { homeFor } from '@/app/guards/RequireAuth';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { FullPageLoader } from '@/components/QueryState';
import { useLogin, useMe } from '@/features/auth/api';
import { ActionIcons, ICON_STROKE } from '@/icons';
import { paths } from '@/lib/paths';

/** Only follow same-app paths after sign-in, never absolute URLs. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export function LoginRoute() {
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ login: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (me.isPending) return <FullPageLoader />;
  if (me.data?.user && !login.isPending) {
    const user = me.data.user;
    return (
      <Navigate
        to={user.mustChangePassword ? paths.changePassword : homeFor(user.userType)}
        replace
      />
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])),
      );
      return;
    }
    setFieldErrors({});
    login.mutate(parsed.data, {
      onSuccess: ({ user }) => {
        const target = user.mustChangePassword
          ? paths.changePassword
          : (safeNext(params.get('next')) ?? homeFor(user.userType));
        void navigate(target, { replace: true });
      },
    });
  };

  return (
    <AuthLayout title="Sign in" subtitle="Use the username or email your administrator gave you.">
      <form onSubmit={submit} noValidate>
        <Stack>
          {login.error ? (
            <Alert color="red" icon={<ActionIcons.warning size={18} stroke={ICON_STROKE} />}>
              {login.error.message}
            </Alert>
          ) : null}
          <TextInput
            label="Username or email"
            autoComplete="username"
            autoFocus
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.currentTarget.value })}
            error={fieldErrors.login}
          />
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
            error={fieldErrors.password}
          />
          <Button type="submit" loading={login.isPending} fullWidth mt="xs">
            Sign in
          </Button>
        </Stack>
      </form>
    </AuthLayout>
  );
}
