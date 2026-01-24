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

- **Worker (NestJS, comando distinto)**:
  - Lee trabajos PENDING de `async_jobs`.
  - Ejecuta evaluación de riesgo.
  - Actualiza estado de la solicitud y del job.

- **Módulo `mock-data`**:
  - Encapsula generación fake (`faker`) y “proveedores” simulados.
  - Mantiene el dominio “limpio” de detalles de demo.

---

## 3. Modelo de datos (resumen)

> Nota: el modelo está intencionalmente cercano al esquema físico. No todos los campos están mapeados aún; se prioriza MVP (multi-tenant, trazabilidad de solicitudes y jobs).

> Nota sobre IDs (UUID): los IDs primarios se modelan como `uuid` pensando en **integraciones** (entre microservicios y con proveedores externos). En un sistema distribuido es común generar IDs fuera de una única base de datos (o en distintos servicios), y `uuid` reduce el riesgo de colisiones y facilita la trazabilidad/compatibilidad al escalar.

### 3.1 Country, Tenants y usuarios

#### country

| Campo | Tipo | Notas |
|---|---|---|
| `code` | (char(2) | PK – e.g. 'ES', 'MX', 'BR' .|
| `name` | (varchar(100) | NOT NULL) – e.g. 'España', 'México'.|
| `status` | (enum/string: |'ACTIVE / INACTIVE' | |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | `deleted_at` para soft-delete |

#### `tenants`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | text |  |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | `deleted_at` para soft-delete |

#### `users`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK → `tenants.id` |
| `email` | varchar | unique por tenant (`ux_users_tenant_email`) |
| `full_name` | varchar |  |
| `role` | enum | `ADMIN`, `AGENT` (`USER_ROLES`) |
| `scopes` | jsonb | nullable (permisos/claims extra) |
| `status` | enum | `ACTIVE`, … (`USER_STATUS`) |
| `last_login_at` | timestamptz | nullable |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | `deleted_at` para soft-delete |

Índices/constraints actuales (según entities):

- `ux_users_tenant_email`: (`tenant_id`, `email`)
- `ix_users_tenant_role`: (`tenant_id`, `role`)

Regla: toda acción se contextualiza siempre con `tenant_id` + `user_id` + `role`.

#### `token` (seguridad / revocación)

Esta tabla funciona como “token store” dev: permite invalidar tokens emitidos sin depender sólo del parsing del string.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `token` | text | token raw (`DEV.v1...`) |
| `type` | enum | `access`, `refresh` (`TOKEN_TYPE`) |
| `user_id` | uuid | FK → `users.id` (nullable) |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | revocación vía soft-delete |

Regla de seguridad (MVP):

- El guard acepta el token **solo si existe** en `token` y `deleted_at IS NULL`.
- “Logout / salida” = **revocar** token (soft-delete) ⇒ desde ese momento, el token ya no tiene acceso.

### 3.2 Solicitudes de crédito

#### `credit_applications`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK → `tenants.id` |
| `created_by` | uuid | FK → `users.id` |
| `country` | char(2) | ISO país (ej. `ES`, `MX`) |
| `full_name` | varchar | PII |
| `document_id` | varchar | PII (NIF, CURP, etc.) |
| `monthly_income` | numeric |  |
| `requested_amount` | numeric |  |
| `status` | enum | `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `ERROR` |
| `bank_info` | jsonb | pseudo-anonimizado si es posible |
| `created_at` / `updated_at` | timestamptz |  |

Índices propuestos:

- `ix_credit_applications_tenant_status_created_at`: (`tenant_id`, `status`, `created_at` DESC)

### 3.3 Catálogos de bancos y proveedores (mock)

#### `banks`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | varchar |  |
| `country` | char(2) |  |
| `code` | varchar | identificador interno |
| `created_at` | timestamptz |  |

#### `risk_providers`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `name` | varchar |  |
| `country` | char(2) |  |
| `code` | varchar |  |

Estos catálogos se siembran vía seed/migración para datos consistentes (local/CI/demo).

### 3.4 Resultados simulados de evaluación

#### `application_bank_results`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `application_id` | uuid | FK → `credit_applications.id` |
| `bank_id` | uuid | FK → `banks.id` |
| `tenant_id` | uuid | FK → `tenants.id` |
| `total_debt` | numeric |  |
| `max_credit_offer` | numeric |  |
| `raw_response` | jsonb | payload fake del “banco” |
| `created_at` | timestamptz |  |

#### `application_risk_scores`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `application_id` | uuid | FK → `credit_applications.id` |
| `provider_id` | uuid | FK → `risk_providers.id` |
| `tenant_id` | uuid | FK → `tenants.id` |
| `score` | numeric | 0–1000 (o similar) |
| `risk_band` | enum/string | `LOW`, `MEDIUM`, `HIGH` |
| `raw_response` | jsonb |  |
| `created_at` | timestamptz |  |

Estos registros se generan on-demand por el worker usando `faker`, pero se persisten para trazabilidad real.

### 3.5 Cola de trabajos y DLQ

#### `async_jobs`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK → `tenants.id` |
| `type` | enum | `RISK_EVAL`, … |
| `payload` | jsonb | típicamente `{ application_id, country }` |
| `status` | enum | `PENDING`, `RUNNING`, `DONE`, `DLQ` |
| `attempts` | int |  |
| `last_error` | text |  |
| `created_at` / `updated_at` | timestamptz |  |
| `processed_at` | timestamptz | nullable |

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

- `POST /api/applications`
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

1) Selecciona N jobs `PENDING`:

```sql
SELECT ...
FROM async_jobs
WHERE status = 'PENDING'
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT N;
```

2) Para cada job:

- Marca como `RUNNING` e incrementa `attempts`.
- Para `RISK_EVAL`:
  - Carga `credit_applications` + `tenant_id` del job.
  - Usa fábrica por país que entrega:
    - `1..n` BankProviders fake (en `mock-data`)
    - `1..n` RiskProviders fake
  - Genera y persiste:
    - `application_bank_results`
    - `application_risk_scores`
  - Decide status final (`APPROVED` / `REJECTED`) por reglas (monto vs ingreso, score, etc.).
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

Tradeoffs:

- ✅ Simplicidad: una sola fuente de verdad (tabla `async_jobs`).
- ✅ No requiere infra extra, fácil de correr en cualquier entorno.
- ❌ A escala, cola en DB limita throughput → migración natural a broker (SQS/Kafka/etc.) manteniendo interfaz.

### 4.4 Mock data y faker

El comportamiento de bancos/proveedores **no** forma parte del dominio core, sino de un módulo `mock-data` (o similar).

Servicios (ejemplo):

- `MockBankProviderService`
- `MockRiskProviderService`

Responsabilidades:

- Leer bancos/proveedores de catálogos.
- Generar respuestas con `faker` (montos/scores realistas).
- Persistir `application_bank_results` y `application_risk_scores`.

Ventaja:

El servicio de evaluación (`EvaluateApplicationService`) depende de interfaces:

- `BankInfoProvider`
- `RiskScoreProvider`

Para producción: adaptadores reales sin cambiar flujo de negocio.

### 4.5 Cache in-memory

Interfaz `CachePort`:

```ts
interface CachePort {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs?: number): void;
  del(key: string): void;
}
```

Implementación actual:

- `InMemoryCacheAdapter` con `Map` + TTL.

Uso previsto:

- Cachear lecturas frecuentes (detalle o listados).
- TTL corto (30–60s).
- Invalidación simple en escrituras (update de status, etc.).

Tradeoffs:

- ✅ No requiere Redis para correr el proyecto (simplifica la prueba).
- ❌ No compartida entre instancias → en cluster: migrar a Redis y ajustar estrategia de invalidación.

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

Nota: se deja la puerta abierta a RLS o multi-schema; el modelo ayuda porque todas las tablas llevan `tenant_id`.

### 5.2 Cola en Postgres vs message broker

Motivo (DB queue):

- Reproducible en la prueba (basta `docker-compose`).
- Trazabilidad simple en una tabla.

Limitaciones:

- Throughput/latencia dependen del tamaño de tabla/config DB.
- A volumen: `PARTITION BY RANGE (fecha)` o por `tenant_id`, o migrar a broker dedicado.

### 5.3 Mock data y faker

- **Ventaja**: demo sin APIs externas, escenarios controlables.
- **Riesgo**: mezclar faker con dominio core lo vuelve difícil de reemplazar.
- **Mitigación**: encapsular en módulo `mock-data` detrás de interfaces.

### 5.4 Cache in-memory

- **Decisión**: cache en memoria por simplicidad.
- **Riesgo**: no compartida entre instancias → lecturas inconsistentes al escalar.
- **Mitigación**: interfaz `CachePort` lista para adapter Redis.

### 5.5 PII y logs

`document_id`, `bank_info`, `full_name` son PII.

Estrategia (MVP):

- No loguear documentos completos ni payloads bancarios crudos.
- Loguear IDs técnicos (`application_id`, `job_id`) y hashes parciales si aplica.

Futuro:

- Encriptar columnas sensibles.
- Políticas de retención por tenant (no cubierto aún en código, pero contemplado).

---

## 6. Próximos pasos

- **End-to-end básico**: `POST /applications` + trigger + worker + cambio de estado.
- **Endpoints de lectura**: listado filtrado con RBAC (ADMIN vs AGENT).
- **Cache**: aplicarla en el listado más “caliente”.
- **Monitoreo básico**:
  - Jobs por estado (`PENDING` / `RUNNING` / `DONE` / `DLQ`)
  - Tiempo promedio de procesamiento por job

Con esto, el backend demuestra:

- Modelado multi-tenant
- RBAC básico pero real
- Procesamiento asíncrono con reintentos y DLQ
- Mock de proveedores externos con trazabilidad