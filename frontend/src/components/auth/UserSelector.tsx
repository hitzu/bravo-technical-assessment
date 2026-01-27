import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Group, Select, Stack, Text } from '@mantine/core';
import { showNotification } from '@mantine/notifications';

import { getUsers, login, logout } from '../../api/services';
import type { User } from '../../api/types/users';

export function UserSelector(props: {
  mode: 'page' | 'header';
  currentUser: User | null;
  onLoggedIn: (user: User) => void;
  onLoggedOut: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getUsers();
        setUsers(response);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    fetchUsers();
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  const options = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.fullName} · ${u.role} · ${u.tenant?.name}`,
      })),
    [users],
  );

  async function handleLogin() {
    if (!selectedUserId) return;
    const selected = users.find((u) => u.id === selectedUserId);
    if (!selected) return;

    try {
      setIsLoading(true);
      const res = await login({ userId: selectedUserId });

      localStorage.setItem('authToken', res.token);

      const currentUser: User = {
        id: selected.id,
        fullName: selected.fullName,
        email: selected.email,
        status: selected.status,
        scopes: selected.scopes,
        lastLoginAt: selected.lastLoginAt,
        tenantId: res.tenantId,
        role: res.role,
        tenant: selected.tenant,
      };
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      props.onLoggedIn(currentUser);

      showNotification({
        title: 'Sesión iniciada',
        message: `Sesión iniciada como Tenant ${res.tenantId} – Rol ${res.role}`,
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Error al iniciar sesión',
        message: err instanceof Error ? err.message : 'Error desconocido',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    try {
      setIsLoading(true);
      await logout();
    } catch {
      // Best-effort logout; token revocation is dev-only anyway.
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      props.onLoggedOut();
      setIsLoading(false);
      showNotification({
        title: 'Sesión cerrada',
        message: 'Se cerró la sesión correctamente.',
        color: 'gray',
      });
    }
  }

  if (!props.currentUser) {
    const content = (
      <Stack gap="sm">
        <Select
          label="Usuario (dev)"
          data={options}
          value={selectedUserId}
          onChange={setSelectedUserId}
          placeholder="Selecciona un usuario"
          searchable
        />
        <Button
          loading={isLoading}
          onClick={handleLogin}
          disabled={!selectedUserId}
        >
          Entrar como este usuario
        </Button>
        <Button variant="light" loading={isLoading} onClick={handleLogout}>
          Logout
        </Button>
      </Stack>
    );

    if (props.mode === 'header') return content;

    return (
      <Group justify="center" mt={64}>
        <Card withBorder w={520}>
          {content}
        </Card>
      </Group>
    );
  }

  return (
    <Group gap="sm" wrap="nowrap">
      <Text size="sm">
        {props.currentUser.fullName} · {props.currentUser.role} ·{' '}
        {props.currentUser.tenant?.name}
      </Text>
    </Group>
  );
}
