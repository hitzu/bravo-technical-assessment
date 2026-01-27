import { useEffect, useState } from 'react';
import { Stack, Table, Text } from '@mantine/core';

import { getDlqJobs } from '../../api/services';
import type { DlqRiskEvaluation } from '../../api/types/api';

export function DlqJobsTable() {
  const [jobs, setJobs] = useState<DlqRiskEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dlqUnavailable, setDlqUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        setDlqUnavailable(false);
        setErrorMessage(null);
        const res = await getDlqJobs();
        if (!res) {
          setDlqUnavailable(true);
          setJobs([]);
          return;
        }
        if (cancelled) return;
        setJobs(res);
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof Error ? err.message : 'Error desconocido',
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Stack gap="sm">
      <Text fw={700}>Jobs en DLQ</Text>

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
