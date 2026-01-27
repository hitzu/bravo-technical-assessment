import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Drawer,
  Group,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';

import {
  getApplicationById,
  listApplications,
  listCountries,
} from '../../api/services';
import type {
  Country,
  CreditApplication,
  PaginatedResponse,
} from '../../api/types/api';
import type { User } from '../../api/types';
import { usePolling } from '../../hooks/usePolling';

const STATUS_OPTIONS = [
  'PENDING',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'ERROR',
] as const;

const APPLICATIONS_POLL_INTERVAL_MS = 5000;

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatRatio(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}

function getRecordNumber(
  record: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function decisionLabel(decision: string): string {
  if (decision === 'APPROVE') return 'APPROVE';
  if (decision === 'REVIEW') return 'REVIEW';
  if (decision === 'REJECT') return 'REJECT';
  return decision;
}

export function ApplicationsTable(props: {
  refreshKey: number;
  currentUser: User | null;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const countriesById = useMemo(
    () => new Map(countries.map((c) => [c.id, c])),
    [countries],
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [countryId, setCountryId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [data, setData] = useState<PaginatedResponse<CreditApplication> | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<CreditApplication | null>(null);

  const countryOptions = useMemo(
    () =>
      countries.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    [countries],
  );
  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
    [],
  );
  const pageSizeOptions = useMemo(
    () =>
      [10, 20, 50].map((n) => ({ value: String(n), label: `${n} / página` })),
    [],
  );

  const pollingEnabled = Boolean(
    localStorage.getItem('authToken') &&
      props.currentUser?.id &&
      props.currentUser?.tenantId,
  );

  const isMountedRef = useRef(true);
  useEffect(() => {
    // React StrictMode mounts/unmounts twice in dev; ensure we reset on mount.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadCountries() {
      try {
        const res = await listCountries();
        if (cancelled) return;
        setCountries(res);
      } catch {
        // Optional catalog; table can still work without names.
      }
    }
    void loadCountries();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLoadedOnceRef = useRef(false);
  const loadList = useCallback(
    async (opts?: { silent?: boolean; background?: boolean }) => {
      if (!pollingEnabled) return;
      try {
        if (!opts?.background) setIsLoading(true);
        const res = await listApplications({
          page,
          pageSize,
          countryId: countryId ?? undefined,
          status: status ?? undefined,
        });
        if (!isMountedRef.current) return;
        setData(res);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (!isMountedRef.current) return;
        if (!opts?.silent) {
          showNotification({
            title: 'Error cargando solicitudes',
            message: err instanceof Error ? err.message : 'Error desconocido',
            color: 'red',
          });
        }
      } finally {
        if (!opts?.background && isMountedRef.current) setIsLoading(false);
        hasLoadedOnceRef.current = true;
      }
    },
    [pollingEnabled, page, pageSize, countryId, status],
  );

  usePolling(
    () => loadList({ silent: true, background: hasLoadedOnceRef.current }),
    {
      enabled: pollingEnabled,
      intervalMs: APPLICATIONS_POLL_INTERVAL_MS,
    },
  );

  const didFirstQueryLoadRef = useRef(false);
  useEffect(() => {
    if (!pollingEnabled) return;
    if (!didFirstQueryLoadRef.current) {
      didFirstQueryLoadRef.current = true;
      return;
    }
    void loadList();
  }, [
    pollingEnabled,
    page,
    pageSize,
    countryId,
    status,
    props.refreshKey,
    loadList,
  ]);

  async function openDetail(id: string) {
    setSelectedId(id);
    setSelectedDetail(null);
    setDrawerOpen(true);
    try {
      const res = await getApplicationById(id);
      setSelectedDetail(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      showNotification({
        title: 'Error cargando detalle',
        message: msg,
        color: 'red',
      });
    }
  }

  const rows = (data?.data ?? []).map((a) => (
    <Table.Tr key={a.id}>
      <Table.Td>{a.fullName}</Table.Td>
      <Table.Td>{countriesById.get(a.countryId)?.name ?? a.countryId}</Table.Td>
      <Table.Td>{a.status}</Table.Td>
      <Table.Td>{a.user.fullName}</Table.Td>
      <Table.Td>
        <Button size="xs" variant="light" onClick={() => void openDetail(a.id)}>
          Ver detalle
        </Button>
      </Table.Td>
    </Table.Tr>
  ));

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
      <Group justify="space-between" align="flex-end">
        <Stack gap={2}>
          <Text fw={700}>Solicitudes de crédito</Text>
          <Text size="xs" c="dimmed">
            Last updated: {lastUpdatedLabel}
          </Text>
        </Stack>
        <Group gap="sm">
          <Select
            label="País"
            data={countryOptions}
            value={countryId}
            onChange={(v) => {
              setCountryId(v);
              setPage(1);
            }}
            clearable
            searchable
            w={220}
          />
          <Select
            label="Estado"
            data={statusOptions}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            clearable
            w={160}
          />
          <Select
            label="Page size"
            data={pageSizeOptions}
            value={String(pageSize)}
            onChange={(v) => {
              const n = Number(v);
              setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
              setPage(1);
            }}
            w={140}
          />
        </Group>
      </Group>

      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nombre</Table.Th>
            <Table.Th>País</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Creado por</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.length > 0 ? (
            rows
          ) : (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed">
                  {isLoading ? 'Cargando...' : 'Sin resultados'}
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Total: {data?.total ?? 0}
        </Text>
        <Pagination
          value={page}
          onChange={setPage}
          total={Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))}
        />
      </Group>

      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Detalle de solicitud"
        position="right"
        size="lg"
      >
        {!selectedId ? null : !selectedDetail ? (
          <Text c="dimmed">Cargando...</Text>
        ) : (
          <Stack gap="xs">
            <Text fw={700}>{selectedDetail.fullName}</Text>
            <Text size="sm">ID: {selectedDetail.id}</Text>
            <Text size="sm">Tenant: {selectedDetail.tenantId}</Text>
            <Text size="sm">
              País:{' '}
              {countriesById.get(selectedDetail.countryId)?.name ??
                selectedDetail.countryId}
            </Text>
            <Text size="sm">Estado: {selectedDetail.status}</Text>
            <Text size="sm">
              Monthly income: {selectedDetail.monthlyIncome}
            </Text>
            <Text size="sm">
              Requested amount: {selectedDetail.requestedAmount}
            </Text>

            <Stack gap={4} mt="sm">
              <Text fw={600}>Risk summary</Text>
              {selectedDetail.riskResult ? (
                (() => {
                  const snapshot =
                    selectedDetail.riskResult.rawBankSnapshot ?? null;
                  const bankIncome =
                    getRecordNumber(snapshot, 'monthlyIncome') ?? null;
                  const totalDebt =
                    getRecordNumber(snapshot, 'totalDebt') ?? null;

                  return (
                    <Stack gap={2}>
                      <Text size="sm">
                        Debt-to-income ratio:{' '}
                        {formatRatio(
                          selectedDetail.riskResult.debtToIncomeRatio,
                        )}{' '}
                        {totalDebt === null || bankIncome === null ? null : (
                          <>
                            (debt {formatNumber(totalDebt)} / income{' '}
                            {formatNumber(bankIncome)})
                          </>
                        )}
                      </Text>
                      <Text size="sm">
                        Requested amount ratio:{' '}
                        {formatRatio(
                          selectedDetail.riskResult
                            .requestedAmountToMonthlyIncomeRatio,
                        )}{' '}
                        (amount {formatNumber(selectedDetail.requestedAmount)} /
                        income {formatNumber(selectedDetail.monthlyIncome)})
                      </Text>
                      <Text size="sm">
                        Decision:{' '}
                        {decisionLabel(selectedDetail.riskResult.decision)}
                      </Text>
                    </Stack>
                  );
                })()
              ) : (
                <Text size="sm" c="dimmed">
                  Aún no disponible
                </Text>
              )}
            </Stack>
          </Stack>
        )}
      </Drawer>
    </Stack>
  );
}
