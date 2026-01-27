import { AppShell, Box, Group, Text } from '@mantine/core';
import type React from 'react';

export function AppLayout(props: {
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700}>Bravo technical assessment</Text>
          <Box>{props.headerRight}</Box>
        </Group>
      </AppShell.Header>

      <AppShell.Main>{props.children}</AppShell.Main>
    </AppShell>
  );
}
