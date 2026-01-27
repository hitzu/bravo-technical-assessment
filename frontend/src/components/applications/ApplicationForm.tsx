import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';

import {
  createApplication,
  listCountries,
  listTenants,
} from '../../api/services';
import type { Country, ErrorResponse, Tenant } from '../../api/types';
import type { User } from '../../api/types';

type FormValues = {
  countryId: string;
  tenantId: string;
  fullName: string;
  documentId: string;
  monthlyIncome: number | '';
  requestedAmount: number | '';
  forceRiskFailure: boolean;
};

export function ApplicationForm(props: {
  currentUser: User | null;
  onCreated: () => void;
}) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormValues>({
    initialValues: {
      countryId: '',
      tenantId: '',
      fullName: '',
      documentId: '',
      monthlyIncome: '',
      requestedAmount: '',
      forceRiskFailure: false,
    },
    validate: {
      countryId: (v) => (v ? null : 'Requerido'),
      tenantId: (v) => (v ? null : 'Requerido'),
      fullName: (v) => (v.trim() ? null : 'Requerido'),
      documentId: (v, values) => {
        const trimmed = v.trim();
        if (!trimmed) return 'Requerido';
        const selectedCountry = countries.find(
          (c) => c.id === values.countryId,
        );
        const pattern = selectedCountry?.documentRegexPattern?.trim();
        const example = selectedCountry?.documentExample ?? '';
        if (!pattern) return null;
        try {
          const regex = new RegExp(pattern);
          if (!regex.test(trimmed)) {
            const label = selectedCountry?.documentLabel ?? 'documento';
            return `Formato inválido (${label}) por ejemplo: ${example}`;
          }
          return null;
        } catch {
          return null;
        }
      },
      monthlyIncome: (v) => (typeof v === 'number' ? null : 'Requerido'),
      requestedAmount: (v) => (typeof v === 'number' ? null : 'Requerido'),
    },
  });

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === form.values.countryId) ?? null,
    [countries, form.values.countryId],
  );

  const documentLabel = selectedCountry?.documentLabel ?? null;
  const documentPattern = selectedCountry?.documentRegexPattern?.trim() ?? '';

  const countryOptions = useMemo(
    () =>
      countries.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    [countries],
  );
  const tenantOptions = useMemo(
    () => tenants.map((t) => ({ value: t.id, label: t.name })),
    [tenants],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoadingOptions(true);
        const [countriesRes, tenantsRes] = await Promise.all([
          listCountries(),
          listTenants(),
        ]);
        if (cancelled) return;
        setCountries(countriesRes);
        setTenants(tenantsRes);

        const defaultCountryId = countriesRes[0]?.id ?? '';
        const defaultTenantId =
          props.currentUser?.tenantId ?? tenantsRes[0]?.id ?? '';
        form.setValues({
          countryId: form.values.countryId || defaultCountryId,
          tenantId: form.values.tenantId || defaultTenantId,
        });
      } catch (err) {
        showNotification({
          title: 'Error cargando catálogos',
          message: err instanceof Error ? err.message : 'Error desconocido',
          color: 'red',
        });
      } finally {
        setIsLoadingOptions(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(values: FormValues) {
    const monthlyIncome = values.monthlyIncome;
    const requestedAmount = values.requestedAmount;
    if (
      typeof monthlyIncome !== 'number' ||
      typeof requestedAmount !== 'number'
    )
      return;

    try {
      setIsSubmitting(true);
      await createApplication({
        countryId: values.countryId,
        tenantId: values.tenantId, // plenamente intencional para demostrar la intención multi-tenant
        fullName: values.fullName.trim(),
        documentId: values.documentId.trim(),
        monthlyIncome,
        requestedAmount,
        forceRiskFailure: values.forceRiskFailure,
      });

      showNotification({
        title: 'Solicitud creada',
        message: 'Solicitud creada. Se ha encolado un job de riesgo.',
        color: 'green',
      });
      props.onCreated();
    } catch (err: unknown | ErrorResponse) {
      console.log('qweqweasdqweasd', (err as ErrorResponse).message);
      showNotification({
        title: 'Error creando solicitud',
        message: err instanceof Error ? err.message : 'Error desconocido',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit((values) => void handleSubmit(values))}>
      <Stack gap="sm">
        <Text fw={700}>Crear solicitud de crédito</Text>

        <Select
          label="País"
          data={countryOptions}
          placeholder={isLoadingOptions ? 'Cargando...' : 'Selecciona un país'}
          disabled={isLoadingOptions}
          {...form.getInputProps('countryId')}
        />

        <Select
          label="Tenant (demo)"
          description="El backend toma el tenant del token; esta selección es solo para demostrar la intención multi-tenant."
          data={tenantOptions}
          placeholder={
            isLoadingOptions ? 'Cargando...' : 'Selecciona un tenant'
          }
          disabled={isLoadingOptions}
          {...form.getInputProps('tenantId')}
        />

        <TextInput
          label="Full name"
          placeholder="Juan Pérez"
          {...form.getInputProps('fullName')}
        />
        <TextInput
          label={documentLabel ? `Document (${documentLabel})` : 'Document'}
          placeholder={documentLabel ? `Ej: ${documentLabel}` : 'XEXX010101000'}
          description={
            documentPattern
              ? 'Validado según el formato del país seleccionado.'
              : undefined
          }
          {...form.getInputProps('documentId')}
        />

        <NumberInput
          label="Monthly income"
          min={0}
          thousandSeparator=","
          {...form.getInputProps('monthlyIncome')}
        />
        <NumberInput
          label="Requested amount"
          min={0}
          thousandSeparator=","
          {...form.getInputProps('requestedAmount')}
        />

        <Checkbox
          label="Forzar fallo de riesgo"
          {...form.getInputProps('forceRiskFailure', { type: 'checkbox' })}
        />

        <Group justify="flex-end" mt="xs">
          <Button type="submit" loading={isSubmitting}>
            Crear
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
