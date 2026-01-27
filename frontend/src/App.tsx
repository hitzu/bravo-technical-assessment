import { useState } from 'react';
import { Card, Divider, Grid, Stack, Text } from '@mantine/core';

import { AppLayout } from './components/layout/AppLayout';
import { UserSelector } from './components/auth/UserSelector';
import { ApplicationForm } from './components/applications/ApplicationForm';
import { ApplicationsTable } from './components/applications/ApplicationsTable';
import { DlqJobsTable } from './components/applications/DlqJobsTable';
import type { User } from './api/types';

function readStoredUser(): User | null {
  const raw = localStorage.getItem('currentUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    localStorage.getItem('authToken') ? readStoredUser() : null,
  );
  const [refreshKey, setRefreshKey] = useState(0);

  const headerRight = (
    <Stack gap="sm">
      <UserSelector
        mode="header"
        currentUser={currentUser}
        onLoggedIn={(u) => setCurrentUser(u)}
        onLoggedOut={() => setCurrentUser(null)}
      />
    </Stack>
  );

  return (
    <AppLayout headerRight={headerRight}>
      <Stack gap="md">
        <UserSelector
          mode="page"
          currentUser={null}
          onLoggedIn={(u) => setCurrentUser(u)}
          onLoggedOut={() => setCurrentUser(null)}
        />

        {currentUser && (
          <Grid gutter="md">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Card withBorder>
                <ApplicationForm
                  currentUser={currentUser}
                  onCreated={() => setRefreshKey((k) => k + 1)}
                />
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 7 }}>
              <Stack gap="md">
                <Card withBorder>
                  <ApplicationsTable
                    refreshKey={refreshKey}
                    currentUser={currentUser}
                  />
                </Card>
                <Divider />
                <Card withBorder>
                  <DlqJobsTable />
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        )}
      </Stack>
    </AppLayout>
  );
}
