# Escalabilidad, grandes volúmenes y trabajo futuro

Este documento responde al punto “Escalabilidad y manejo de grandes volúmenes” del enunciado y deja un checklist claro de qué haríamos para llevar este MVP a un entorno con **millones** de solicitudes.

## 1. Índices recomendados

### 1.1 `credit_applications` (lecturas más frecuentes)

Uso típico:
- listado por tenant + filtros + orden por fecha,
- scoping por AGENT (mis solicitudes),
- detalle por id.

Lo que **ya existe**:
- `ix_credit_applications_tenant_status_created_at` en (`tenant_id`, `status`, `created_at`)

Índices **recomendados** si crece el volumen:
- `(tenant_id, country_id, created_at DESC)` para filtros por país con orden por fecha.
- `(tenant_id, created_by, created_at DESC)` para “mis solicitudes” (AGENT) con orden por fecha.
- `(tenant_id, id)` (siempre útil como apoyo a joins/filtros multi-tenant).

### 1.2 `application_risk_results`

Uso típico:
- “último resultado” por solicitud en el detalle.

Lo que **ya existe**:
- `ix_application_risk_results_tenant_application` en (`tenant_id`, `application_id`)

Índices **recomendados** si hay muchos resultados por solicitud:
- `(tenant_id, application_id, created_at DESC)` para “último resultado” sin escaneo.

### 1.3 `async_jobs`

Uso típico:
- consumo FIFO-ish por estado,
- debug por tenant + estado,
- auditoría de DLQ.

Lo que **ya existe**:
- `ix_async_jobs_status_created` en (`status`, `created_at`)
- `ix_async_jobs_tenant_status` en (`tenant_id`, `status`)

Índices **recomendados** si el throughput sube:
- `(status, created_at, id)` para estabilizar orden y paginación interna.
- (opcional) particionar por `created_at` si el bloat/retención crece (ver sección 2).

### 1.4 `webhook_deliveries`

Uso típico:
- auditoría por tenant y estado,
- ver historial por solicitud.

Lo que **ya existe**:
- `ix_webhook_deliveries_tenant_type_status` en (`tenant_id`, `type`, `status`)
- `ix_webhook_deliveries_tenant_application` en (`tenant_id`, `application_id`)

Índices **recomendados**:
- `(tenant_id, created_at DESC)` para dashboards “últimos eventos”.
- (si se implementa idempotencia estricta) índice único por `(tenant_id, idempotency_key)` cuando `idempotency_key` no sea null.

## 2. Particionamiento y archivado

Si `credit_applications` crece hacia decenas de millones:

- **Particionado por rango de tiempo** (mensual/trimestral) en `created_at`.
  - Beneficio: índices más pequeños por partición, VACUUM más predecible, queries por rango más rápidas.
- Alternativa: **particionado por `tenant_id`** (hash) si hay tenants muy grandes y el acceso es casi siempre por tenant.

Archivado/retención:
- Definir una política de retención (por ejemplo 12–24 meses).
- Mover datos “fríos” a:
  - particiones “detach” en storage más barato, o
  - tablas de archivo (por ejemplo `credit_applications_archive`), manteniendo solo agregados recientes en caliente.

## 3. Consultas críticas y patrones de acceso

### 3.1 Listado por tenant + filtros + fecha

Endpoints involucrados:
- `GET /applications` (backend)
- polling cada ~5s en el frontend

Si crece el volumen:
- migrar de `offset/limit` a **keyset pagination** (por ejemplo por `(created_at, id)`), para evitar que `OFFSET` sea costoso con millones de filas.
- asegurar índices compuestos que reflejen el filtro real (tenant + status/country + fecha).

### 3.2 Detalle + último resultado de riesgo

Hoy el detalle:
- devuelve la solicitud + el último `application_risk_results` (ordenado por `created_at DESC`)
- y se cachea ~60s.

Evolución posible:
- materializar “último risk result id” en `credit_applications` si se vuelve hot path.
- separar el “snapshot bancario” (JSON) si crece demasiado y complica IO/transferencias.

### 3.3 Consumo de jobs

Patrón actual:
- selección en `async_jobs` por `status=PENDING` ordenado por `created_at`
- lock por fila con `SKIP LOCKED`

Escalado:
- correr N workers en paralelo (ya es compatible).
- si hay millones/día, migrar a una cola dedicada o job runner con features de reintento/backoff y “delayed jobs”.

## 4. Colas y procesamiento masivo de jobs

Lo actual (demo):
- cola en Postgres (`async_jobs`)
- un tipo principal `RISK_EVAL`
- DLQ cuando falla repetidamente o el payload es inválido

Si el sistema escala:
- migrar el encolamiento a una cola dedicada (Rabbit/Kafka) o a un job runner (por ejemplo BullMQ) para:
  - retries con backoff,
  - rate limiting,
  - scheduling,
  - prioridades,
  - y observabilidad de jobs.
- mantener la misma idea de “DLQ” pero con tooling más sólido (dead-letter topics/queues, dashboards).

## 5. Cache distribuida

Hoy:
- cache in-memory implementando `CachePort`
- TTLs cortos (countries/tenants/detalle de solicitud)

En producción:
- reemplazar el adapter por Redis sin cambiar la interfaz.
- definir invalidación basada en eventos/escrituras de forma consistente:
  - al cambiar el estado (manual o por webhook),
  - al persistir riesgo,
  - al cambiar catálogos.
- si hay varios pods: evitar “stale reads” por caches independientes.

## 6. Observabilidad avanzada

Hoy:
- logs estructurados (nestjs-pino)
- trazabilidad razonable por tablas (`async_jobs`, `webhook_deliveries`)

Mejoras recomendadas:
- **Métricas**:
  - jobs procesados/minuto,
  - jobs en `DLQ`,
  - latencia por endpoint (p95/p99),
  - ratio de `IN_REVIEW` vs `APPROVED/REJECTED`,
  - errores de validación por país (document regex).
- **Trazas**:
  - correlación request ↔ job ↔ webhook (propagar `x-request-id` / idempotency key).
- **Alertas**:
  - DLQ creciendo,
  - tiempo de procesamiento de jobs,
  - fallas de webhooks (cuando se implementen como outbound real).

## 7. Trabajo futuro a nivel de producto

Para “cerrar el círculo” del MVP hacia producto:
- UI para administrar `country_rules` (versionado, activar/desactivar, auditoría).
- Dashboard operativo:
  - cola `async_jobs` (PENDING/RUNNING/DLQ),
  - `webhook_deliveries` (PENDING/SENT/FAILED),
  - y métricas de tiempos.
- Realtime real (SSE/Socket.IO) para cambios de estado/resultados de riesgo (reemplazando polling o reduciéndolo).

