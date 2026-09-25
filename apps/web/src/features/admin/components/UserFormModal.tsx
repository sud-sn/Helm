import {
  Alert,
  Button,
  Checkbox,
  Group,
  Modal,
  PasswordInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { createUserSchema, type TemporaryPasswordResponse, type UserType } from '@helm/shared';
import { useClients } from '@/features/clients/api';
import { apiErrors, emptyToNull, validate } from '@/lib/forms';
import { useCreateUser } from '../api';

/** Admins create every account: staff, or client users tied to one client company. */
interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (result: TemporaryPasswordResponse) => void;
}

export function UserFormModal({ opened, onClose, onCreated }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="New user" size="md">
      <UserForm onClose={onClose} onCreated={onCreated} />
    </Modal>
  );
}

function UserForm({ onClose, onCreated }: Omit<Props, 'opened'>) {
  const create = useCreateUser();
  const clients = useClients();
  const [userType, setUserType] = useState<UserType>('staff');
  const [values, setValues] = useState({
    username: '',
    displayName: '',
    email: '',
    clientId: null as string | null,
    isAdmin: false,
  });
  const [setPassword, setSetPassword] = useState(false);
  const [password, setPasswordValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(createUserSchema, {
      username: values.username,
      displayName: values.displayName,
      email: emptyToNull(values.email),
      userType,
      clientId: userType === 'client' ? values.clientId : null,
      isAdmin: userType === 'staff' && values.isAdmin,
      password: setPassword ? password : undefined,
    });
    if (result.errors) return setErrors(result.errors);
    create.mutate(result.data, {
      onSuccess: (created) => {
        onClose();
        onCreated(created);
      },
      onError: (error) => setErrors(apiErrors(error)),
    });
  };

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {errors.form ? <Alert color="red">{errors.form}</Alert> : null}
        <SegmentedControl
          fullWidth
          value={userType}
          onChange={(value) => setUserType(value as UserType)}
          data={[
            { value: 'staff', label: 'Team member' },
            { value: 'client', label: 'Client user' },
          ]}
        />
        <Text size="xs" c="dimmed">
          {userType === 'staff'
            ? 'Agency staff. Give them roles on clients or projects after creating the account.'
            : 'Someone at a client company. They only see what your team shares with that client.'}
        </Text>
        {userType === 'client' ? (
          <Select
            label="Client company"
            data={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            value={values.clientId}
            onChange={(value) => setValues({ ...values, clientId: value })}
            error={errors.clientId}
            searchable
          />
        ) : null}
        <TextInput
          label="Full name"
          value={values.displayName}
          onChange={(e) => setValues({ ...values, displayName: e.currentTarget.value })}
          error={errors.displayName}
        />
        <TextInput
          label="Username"
          description="Used to sign in and for @mentions"
          placeholder="priya.s"
          value={values.username}
          onChange={(e) => setValues({ ...values, username: e.currentTarget.value.toLowerCase() })}
          error={errors.username}
        />
        <TextInput
          label="Email (optional)"
          description="Can also be used to sign in"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.currentTarget.value })}
          error={errors.email}
        />
        {userType === 'staff' ? (
          <Checkbox
            label="Administrator (manages accounts and access)"
            checked={values.isAdmin}
            onChange={(e) => setValues({ ...values, isAdmin: e.currentTarget.checked })}
          />
        ) : null}
        <Checkbox
          label="Set the first password myself (otherwise one is generated)"
          checked={setPassword}
          onChange={(e) => setSetPassword(e.currentTarget.checked)}
        />
        {setPassword ? (
          <PasswordInput
            label="Temporary password"
            description="They will be asked to change it when they first sign in"
            value={password}
            onChange={(e) => setPasswordValue(e.currentTarget.value)}
            error={errors.password}
          />
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create user
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
