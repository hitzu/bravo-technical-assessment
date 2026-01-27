import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, Table, Text } from '@mantine/core';

import { getDlqJobs } from '../../api/services';
import type { DlqRiskEvaluation } from '../../api/types/api';
import { usePolling } from '../../hooks/usePolling';

const DLQ_POLL_INTERVAL_MS = 10000;

export function DlqJobsTable() {
  const [jobs, setJobs] = useState<DlqRiskEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dlqUnavailable, setDlqUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const pollingEnabled = Boolean(
    localStorage.getItem('authToken') && localStorage.getItem('currentUser'),
  );

  const isMountedRef = useRef(true);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    // React StrictMode mounts/unmounts twice in dev; ensure we reset on mount.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (opts?: { background?: boolean }) => {
      if (!pollingEnabled) return;
      const background = Boolean(opts?.background);

      try {
        if (!background) setIsLoading(true);

        const res = await getDlqJobs();
        if (!isMountedRef.current) return;

        if (!res) {
          setDlqUnavailable(true);
          setJobs([]);
          setLastUpdatedAt(new Date());
          return;
        }

        setDlqUnavailable(false);
        setErrorMessage(null);
        setJobs(res);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!isMountedRef.current) return;
        setErrorMessage(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        if (!background && isMountedRef.current) setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
    },
    [pollingEnabled],
  );

  usePolling(
    () => load({ background: hasLoadedOnceRef.current }),
    {
      enabled: pollingEnabled,
      intervalMs: DLQ_POLL_INTERVAL_MS,
    },
  );

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdatedAt) return '—';
    return lastUpdatedAt.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, [lastUpdatedAt]);

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <Text fw={700}>Jobs en DLQ</Text>
        <Text size="xs" c="dimmed">
          Last updated: {lastUpdatedLabel}
        </Text>
      </Stack>

      {dlqUnavailable ? (
        <Text c="dimmed">DLQ aún no disponible</Text>
      ) : errorMessage ? (
        <Text c="red">{errorMessage}</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>applicationId</Table.Th>
              <Table.Th>fullName</Table.Th>
              <Table.Th>jobStatus</Table.Th>
              <Table.Th>attempts</Table.Th>
              <Table.Th>lastError</Table.Th>
              <Table.Th>updatedAt</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {jobs.length > 0 ? (
              jobs.map((j) => (
                <Table.Tr key={j.id}>
                  <Table.Td>{j.id}</Table.Td>
                  <Table.Td>{j.fullName}</Table.Td>
                  <Table.Td>{j.riskEvalJob?.status ?? '-'}</Table.Td>
                  <Table.Td>{j.riskEvalJob?.attempts ?? '-'}</Table.Td>
                  <Table.Td>{j.riskEvalJob?.lastError ?? '-'}</Table.Td>
                  <Table.Td>{new Date(j.updatedAt).toLocaleString()}</Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed">
                    {isLoading ? 'Cargando...' : 'Sin jobs'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}
