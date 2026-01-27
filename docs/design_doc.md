## Bravo — Diseño de Backend (v0.1)

Bravo es un backend **multi-tenant** para gestionar **solicitudes de crédito** con:

- **RBAC**: `ADMIN` / `AGENT`
- **Procesamiento asíncrono** de evaluación de riesgo (cola en PostgreSQL + worker)
- **Integraciones simuladas** (bancos / proveedores de riesgo) con trazabilidad persistida
- **Cache in-memory** detrás de una interfaz (lista para migrar a Redis)

El objetivo es demostrar:

- **Modelado de datos** pensando en multi-tenant y crecimiento.
- **Procesamiento en background** con reintentos y **DLQ**.
- Separación razonable entre **core de negocio** y **mock/demo**.

### Glosario rápido

- **Tenant**: organización/cliente aislado lógicamente.
- **RBAC**: control de acceso basado en roles.
- **DLQ** (Dead Letter Queue): “buzón” para trabajos fallidos tras reintentos.
- **Worker**: proceso que consume trabajos de la cola y ejecuta lógica pesada.

---

## 1. Contexto y objetivo

Este documento describe un diseño de referencia para un backend de solicitudes de crédito multi-tenant, priorizando:

- Trazabilidad de decisiones (qué proveedores respondieron qué, y cuándo).
- Robustez operativa (reintentos + DLQ).
- Evolución sin fricción (cache swappable, auth reemplazable por JWT real).

---

## 2. Arquitectura general

### 2.1 Tecnologías

- **Backend**: NestJS + TypeScript
- **DB**: PostgreSQL (vía `docker-compose` en local)
- **Auth (MVP)**: token dev simple + “token store” para revocación:

`DEV.v1.{tenantId}.{userId}.{role}.{timestamp}`

Incluye `tenantId`, `userId`, `role`.

- Además, cada token emitido se registra en DB (tabla `token`) y el guard valida que el token exista y no esté revocado (soft-delete). Esto permite **deshabilitar acceso** cuando alguien “sale” (logout) sin cambiar el formato del token.
- **Cola de trabajos**: tabla `async_jobs` en PostgreSQL + worker en el mismo repo.
- **Cache**: in-memory detrás de una interfaz `CachePort` (migrable a Redis).

### 2.2 Componentes lógicos

- **API HTTP (NestJS)**:
  - CRUD básico de solicitudes.
  - Listados con RBAC.
  - Endpoint(s) internos para disparar/depurar el procesamiento de jobs.

- **Worker (servicio en el mismo backend)**:
  - Lee trabajos `PENDING` de `async_jobs` (con `FOR UPDATE SKIP LOCKED`).
  - Ejecuta evaluación de riesgo y persiste `application_risk_results`.
  - Actualiza estado del job y, si corresponde, estado de la solicitud.
  - Se ejecuta:
    - vía cron (feature flag) o
    - manual/debug vía `POST /jobs/process`.

- **Módulo `mock-data`**:
  - Encapsula generación fake (`faker`) y “proveedores” simulados.
  - Mantiene el dominio “limpio” de detalles de demo.

---

## 3. Modelo de datos (resumen)

> Nota: el modelo está intencionalmente cercano al esquema físico. No todos los campos están mapeados aún; se prioriza MVP (multi-tenant, trazabilidad de solicitudes y jobs).

> Nota sobre IDs (UUID): los IDs primarios se modelan como `uuid` pensando en **integraciones** (entre microservicios y con proveedores externos). En un sistema distribuido es común generar IDs fuera de una única base de datos (o en distintos servicios), y `uuid` reduce el riesgo de colisiones y facilita la trazabilidad/compatibilidad al escalar.

### 3.1 Country, Tenants y usuarios

#### country

| Campo                                      | Tipo          | Notas                                |
| ------------------------------------------ | ------------- | ------------------------------------ | --- |
| `id`                                       | uuid          | **PK** (en el repo, `BaseEntity`)    |
| `code`                                     | char(2)       | **UNIQUE** – e.g. 'ES', 'MX', 'BR'   |
| `name`                                     | (varchar(100) | NOT NULL) – e.g. 'España', 'México'. |
| `status`                                   | (enum/string: | 'ACTIVE / INACTIVE'                  |     |
| `created_at` / `updated_at` / `deleted_at` | timestamptz   | `deleted_at` para soft-delete        |

#### `country_rules` (knobs por país)

En el repo existe una tabla de reglas versionadas por país, usada por el evaluador para tomar decisiones sin hardcodear umbrales:

| Campo                                         | Tipo        | Notas                                   |
| --------------------------------------------- | ----------- | --------------------------------------- |
| `id`                                          | uuid        | PK                                      |
| `country_id`                                  | uuid        | FK → `countries.id`                     |
| `version`                                     | int         | versionado (unique por país)            |
| `is_active`                                   | boolean     | regla activa más reciente               |
| `document_min_length` / `document_max_length` | int         | knobs de validación de documento        |
| `dti_approve_max` / `dti_review_max`          | numeric     | thresholds de debt-to-income            |
| `requested_amount_review_threshold`           | numeric     | umbral de “review” (ej. ES)             |
| `requested_amount_to_monthly_income_*`        | numeric     | thresholds income vs amount (ej. MX/PT) |
| `min_monthly_income`                          | numeric     | income mínimo                           |
| `min_risk_score_*`                            | int         | knobs opcionales para score             |
| `created_at` / `updated_at` / `deleted_at`    | timestamptz | soft-delete                             |

#### `tenants`

| Campo                                      | Tipo        | Notas                         |
| ------------------------------------------ | ----------- | ----------------------------- |
| `id`                                       | uuid        | PK                            |
| `name`                                     | text        |                               |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | `deleted_at` para soft-delete |

#### `users`

| Campo                                      | Tipo        | Notas                                       |
| ------------------------------------------ | ----------- | ------------------------------------------- |
| `id`                                       | uuid        | PK                                          |
| `tenant_id`                                | uuid        | FK → `tenants.id`                           |
| `email`                                    | varchar     | unique por tenant (`ux_users_tenant_email`) |
| `full_name`                                | varchar     |                                             |
| `role`                                     | enum        | `ADMIN`, `AGENT` (`USER_ROLES`)             |
| `scopes`                                   | jsonb       | nullable (permisos/claims extra)            |
| `status`                                   | enum        | `ACTIVE`, … (`USER_STATUS`)                 |
| `last_login_at`                            | timestamptz | nullable                                    |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | `deleted_at` para soft-delete               |

Índices/constraints actuales (según entities):

- `ux_users_tenant_email`: (`tenant_id`, `email`)
- `ix_users_tenant_role`: (`tenant_id`, `role`)

Regla: toda acción se contextualiza siempre con `tenant_id` + `user_id` + `role`.

#### `token` (seguridad / revocación)

Esta tabla funciona como “token store” dev: permite invalidar tokens emitidos sin depender sólo del parsing del string.

| Campo                                      | Tipo        | Notas                              |
| ------------------------------------------ | ----------- | ---------------------------------- |
| `id`                                       | uuid        | PK                                 |
| `token`                                    | text        | token raw (`DEV.v1...`)            |
| `type`                                     | enum        | `access`, `refresh` (`TOKEN_TYPE`) |
| `user_id`                                  | uuid        | FK → `users.id` (nullable)         |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | revocación vía soft-delete         |

Regla de seguridad (MVP):

- El guard acepta el token **solo si existe** en `token` y `deleted_at IS NULL`.
- “Logout / salida” = **revocar** token (soft-delete) ⇒ desde ese momento, el token ya no tiene acceso.

### 3.2 Solicitudes de crédito

#### `credit_applications`

| Campo                       | Tipo        | Notas                                                   |
| --------------------------- | ----------- | ------------------------------------------------------- |
| `id`                        | uuid        | PK                                                      |
| `tenant_id`                 | uuid        | FK → `tenants.id`                                       |
| `created_by`                | uuid        | FK → `users.id`                                         |
| `country_id`                | uuid        | FK → `countries.id`                                     |
| `full_name`                 | varchar     | PII                                                     |
| `document_id`               | varchar     | PII (NIF, CURP, etc.)                                   |
| `monthly_income`            | numeric     |                                                         |
| `requested_amount`          | numeric     |                                                         |
| `status`                    | enum        | `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `ERROR` |
| `bank_info`                 | jsonb       | pseudo-anonimizado si es posible                        |
| `force_risk_failure`        | boolean     | flag de testing: fuerza DLQ/ERROR en el worker          |
| `created_at` / `updated_at` | timestamptz |                                                         |

Índices propuestos:

- `ix_credit_applications_tenant_status_created_at`: (`tenant_id`, `status`, `created_at` DESC)

### 3.3 Resultados de evaluación (implementado)

#### `application_risk_results`

| Campo                                      | Tipo        | Notas                                       |
| ------------------------------------------ | ----------- | ------------------------------------------- |
| `id`                                       | uuid        | PK                                          |
| `application_id`                           | uuid        | FK → `credit_applications.id`               |
| `tenant_id`                                | uuid        | FK → `tenants.id`                           |
| `country_id`                               | uuid        | FK → `countries.id`                         |
| `debt_to_income_ratio`                     | numeric     | `totalDebt / monthlyIncome`                 |
| `risk_score`                               | int         | score calculado por estrategia              |
| `decision`                                 | enum        | `APPROVE/REJECT/REVIEW`                     |
| `raw_bank_snapshot`                        | jsonb       | snapshot normalizado del proveedor bancario |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | soft-delete                                 |

> Nota: el “detalle por banco/proveedor” (tablas separadas) no existe hoy; se guarda un snapshot normalizado en `raw_bank_snapshot`.

### 3.4 Catálogos de bancos y proveedores (propuesto / no implementado)

En una iteración siguiente, este diseño contemplaba separar:

- `banks`
- `risk_providers`
- `application_bank_results`
- `application_risk_scores`

Hoy, para simplificar el MVP, se consolidó en `credit_applications.bank_info` + `application_risk_results.raw_bank_snapshot`.

### 3.5 Cola de trabajos y DLQ

#### `async_jobs`

| Campo                       | Tipo        | Notas                                     |
| --------------------------- | ----------- | ----------------------------------------- |
| `id`                        | uuid        | PK                                        |
| `tenant_id`                 | uuid        | FK → `tenants.id`                         |
| `type`                      | enum        | `RISK_EVAL`, …                            |
| `payload`                   | jsonb       | típicamente `{ application_id, country }` |
| `status`                    | enum        | `PENDING`, `RUNNING`, `DONE`, `DLQ`       |
| `attempts`                  | int         |                                           |
| `last_error`                | text        |                                           |
| `created_at` / `updated_at` | timestamptz |                                           |
| `processed_at`              | timestamptz | nullable                                  |

Índices propuestos:

- `ix_async_jobs_status_created_at`: (`status`, `created_at`)
- (Opcional) `ix_async_jobs_tenant_status`: (`tenant_id`, `status`)

#### Trigger de inserción (DB)

Trigger en `credit_applications` **AFTER INSERT**:

- Inserta un job en `async_jobs` con:
  - `tenant_id`: el de la solicitud
  - `type = 'RISK_EVAL'`
  - `payload`: `application_id` + metadatos necesarios

Esto crea una cola DB sin infra adicional (Rabbit/Kafka).

---

## 4. Implementación (flujos principales)

### 4.1 Autenticación y RBAC

El backend recibe un header con un token estilo:

`DEV.v1.{tenantId}.{userId}.{role}.{timestamp}`

Un guard de NestJS:

- Parsea el token.
- Adjunta `tenantId`, `userId`, `role` al `Request`.
- Valida que el token esté **registrado y activo** en DB (tabla `token`): si no existe o fue revocado (soft-delete), responde `401`.

RBAC:

- **AGENT**
  - Puede crear `credit_applications`.
  - En `GET /applications`, sólo ve las suyas (`created_by = user_id`).

- **ADMIN**
  - Puede ver todas las solicitudes del `tenant_id`.
  - Puede actualizar status (`PATCH /applications/:id/status`).
  - Puede disparar endpoints internos (ej. procesar un job manualmente).

Tradeoff: el token es simple para la prueba, pero el diseño permite migrar a JWT real sin tocar reglas de negocio (sólo guard/capa de auth).

### 4.2 Creación de solicitud y encolado de job

Flujo:

- `POST /applications`
  - Valida payload (país, documento, ingreso, monto).
  - Infiere `tenant_id` y `created_by` desde el token.
  - Inserta en `credit_applications`.

Trigger en DB:

- Inserta `async_jobs` con `type = 'RISK_EVAL'`.

Respuesta:

- Devuelve la solicitud creada (estado inicial `PENDING` o `IN_REVIEW`).

Ventaja: API rápida; procesamiento pesado a background.

### 4.3 Worker de evaluación de riesgo

Componente conceptual: `JobsProcessorService`.

Loop cada X segundos:

1. Selecciona N jobs `PENDING`:

```sql
SELECT ...
FROM async_jobs
WHERE status = 'PENDING'
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT N;
```

2. Para cada job:

- Marca como `RUNNING` e incrementa `attempts`.
- Para `RISK_EVAL`:
  - Carga `credit_applications` + `tenant_id` del job.
  - Resuelve provider bancario por país (hoy: `ES` y `MX`) y obtiene `bankSnapshot`.
  - Evalúa riesgo por estrategia por país (registry + fallback) y regla activa de `country_rules` (si existe).
  - Persiste `application_risk_results` (incluye `raw_bank_snapshot`).
  - Puede marcar la solicitud como `IN_REVIEW` cuando la decisión es `REVIEW`.
  - Actualiza:
    - `credit_applications.status`
    - `async_jobs.status = DONE` + `processed_at`

Manejo de errores:

- Error recuperable:
  - incrementa `attempts`, actualiza `last_error`
  - si `attempts < MAX_RETRIES` → vuelve a `PENDING`
  - si `attempts >= MAX_RETRIES` → `DLQ`
- Error no recuperable (ej. datos inconsistentes):
  - job a `DLQ` directamente
  - `credit_applications.status = ERROR`

Tradeoffs pensados en prueba:

- Simplicidad: una sola fuente de verdad (tabla `async_jobs`).
- Cola en DB limita throughput, migración natural a broker (SQS/Kafka/etc.) manteniendo interfaz.

### 4.4 Mock data y faker

El comportamiento de bancos/proveedores **no** forma parte del dominio core, sino de un módulo `mock-data` (o similar).

Servicios (en el repo):

- `BankProviderRegistryService` + providers por país (hoy: ES/MX)
- `RiskStrategyRegistryService` + estrategias por país (hoy: ES/MX + fallback)

Responsabilidades:

- Generar snapshots bancarios (mock) y normalizarlos.
- Calcular score/DTI/decisión y persistir `application_risk_results`.

Ventaja:

El servicio de evaluación (`EvaluateApplicationService`) depende de interfaces:

- `BankInfoProvider`
- `RiskScoreProvider`

Para producción: adaptadores reales sin cambiar flujo de negocio.

### 4.5 Cache in-memory

Interfaz `CachePort`:

```ts
interface CachePort {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  del(key: string): void;
  reset(): void;
}
```

Uso previsto:

- Cachear lecturas frecuentes (detalle o listados).
- TTL corto (30–60s).
- Invalidación simple en escrituras (update de status, etc.).

Tradeoffs:

- Redis no se implementa (simplifica la prueba).
- Cache in memory no es adaptable a microservicios ya que no comparte el status en cluster, migrar a Redis y ajustar estrategia de invalidación.

---

## 5. Tradeoffs y decisiones explícitas

### 5.1 Multi-tenant

Decisión: un solo esquema con `tenant_id` en todas las tablas de negocio.

- Ejemplos de uso de `tenant_id` (Bravo como suite de productos):
  - **Recuperación de crédito**: un `tenant_id` puede representar el producto/línea “recuperación”, con sus propios usuarios, reglas y datos aislados.
  - **Préstamo de dinero**: otro `tenant_id` puede representar el producto/línea “préstamos”, aislando completamente solicitudes, jobs y resultados.

- Ejemplo mental: si Bravo corre ambos productos en el mismo backend/DB, separar por `tenant_id` permite que cada producto tenga su **propio espacio lógico** (usuarios, permisos, catálogos, datos y trazabilidad) sin mezclar información entre líneas de negocio.

- **Pros**:
  - Más simple de operar/evolucionar en MVP.
  - Menos overhead que multi-schema.
- **Contras**:
  - Hay que ser estricto en RBAC y filtros por `tenant_id`.
  - Tenants grandes pueden requerir particionado (por país/tenant/fecha).

### 5.2 Cola en Postgres vs message broker

Motivo (DB queue):

- Reproducible en la prueba (basta `docker-compose`).
- Trazabilidad simple en una tabla.

Limitaciones:

- Throughput/latencia dependen del tamaño de tabla/config DB.
- Migrar a broker dedicado o cola especializada (kafka, sqs).

### 5.3 Mock data y faker

- **Ventaja**: demo sin APIs externas, escenarios controlables.
- **Riesgo**: mezclar faker con dominio core lo vuelve difícil de reemplazar.
- **Mitigación**: encapsular en módulo `mock-data` detrás de interfaces.

### 5.4 Cache in-memory

- **Decisión**: cache en memoria por simplicidad.
- **Riesgo**: no compartida entre instancias, lecturas inconsistentes al escalar.
- **Mitigación**: interfaz `CachePort` lista para adapter Redis.

### 5.5 PII y logs

`document_id`, `bank_info`, `full_name` son ejemplos de PII.

Estrategia (MVP):

- No loguear documentos completos ni payloads bancarios crudos.
- Proteccion via Pino, en src/config/logger/logger.config.ts se configuran los posibles campos a censurar en logs, previniendo logs con informacion sensible
- Loguear IDs técnicos (`application_id`, `job_id`) y hashes parciales si aplica.

Futuro:

- Encriptar columnas sensibles.

---

## 6. TL;DR

Con esto, el backend demuestra:

- Modelado multi-tenant
- RBAC básico pero real
- Procesamiento asíncrono con reintentos y DLQ
- Mock de proveedores externos con trazabilidad
