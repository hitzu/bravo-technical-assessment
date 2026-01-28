# Decisiones técnicas

Este documento explica **por qué** el proyecto está construido como está, y qué tradeoffs se tomaron para llegar a un MVP sólido y fácil de revisar.

## 1. Arquitectura general

- **NestJS por módulos**: el backend está separado en módulos de dominio (por ejemplo: `credit-applications`, `async-jobs`, `countries`, `tenants`, `webhook-deliveries`, `auth`).
- **Controllers vs Services**:
  - **Controllers** exponen endpoints HTTP y delegan la lógica.
  - **Services** contienen la lógica de negocio y coordinan repositorios/servicios.
- No es una arquitectura hexagonal “pura”, pero sí hay **separación razonable**:
  - Infra (DB/TypeORM) aislada en repositorios.
  - Lógica de negocio en servicios.
  - “Puertos” puntuales (por ejemplo `CachePort`) para evitar acoplamiento fuerte a una tecnología concreta.

## 2. Multi-tenant y RBAC

### 2.1 Multi-tenant (aislamiento)

- El aislamiento se modela con una columna **`tenant_id`** en tablas de negocio:
  - `users`, `credit_applications`, `application_risk_results`, `async_jobs`, `webhook_deliveries`.
- En runtime, el `tenantId` viene del token de autenticación de demo y se usa como filtro:
  - Ejemplo típico: `WHERE tenant_id = :tenantId`.

### 2.2 Token “DEV.v1…” y validación

Para la prueba se implementó un **token de desarrollo**, con formato:

- `DEV.v1.<tenantId>.<userId>.<role>.<timestamp>`

La validación tiene 2 capas (intencionalmente simples):

- **Parsing** (formato): se valida que `tenantId` y `userId` sean UUID y que el `role` sea `ADMIN` o `AGENT`.
- **Token store** (revocable): además de parsearse, el token debe existir en la tabla `token` y no estar revocado (soft-delete). Esto permite “logout” real en la demo.

### 2.3 RBAC (ADMIN vs AGENT)

Reglas principales:

- **ADMIN**
  - Puede listar todas las solicitudes del tenant.
  - Puede cambiar manualmente el estado **solo** cuando está en `IN_REVIEW` (override a `APPROVED` o `REJECTED`).
- **AGENT**
  - Puede crear solicitudes.
  - Solo ve sus propias solicitudes (scoping por `credit_applications.created_by = userId`).

### 2.4 Por qué `/users` es público (solo demo)

`GET /users` está público para que el revisor pueda:

- listar usuarios rápidamente,
- elegir uno en el frontend,
- y hacer `POST /auth/login` sin fricción.

En un sistema real, `/users` estaría protegido y también scopiado por tenant.

## 3. Procesamiento asíncrono y cola en Postgres

### 3.1 Flujo “INSERT → job”

El flujo central es:

1. `POST /applications` crea una fila en `credit_applications`.
2. Un **trigger en Postgres** (`AFTER INSERT`) encola un job en `async_jobs`:
   - `type = RISK_EVAL`
   - `payload = { applicationId: "<uuid>" }`
   - `status = PENDING`

Esto garantiza que **toda** solicitud creada en DB tiene su job asociado, incluso si la API cae después del insert.

### 3.2 Worker y paralelismo (SKIP LOCKED)

El worker (`AsyncJobsProcessorService`) toma jobs pendientes con:

- `FOR UPDATE SKIP LOCKED`

Esto habilita correr **N workers** en paralelo sin pisarse: cada worker “bloquea” filas distintas.

Estados de job:

- `PENDING`: listo para procesar.
- `RUNNING`: tomado por un worker (se incrementa `attempts`).
- `DONE`: procesado y marcado con `processed_at`.
- `DLQ`: falló repetidamente o el input es inválido (se guarda `last_error`).

### 3.3 Por qué Postgres “como cola”

Tradeoff intencional para una prueba técnica:

- **Menos infraestructura** no usamos Rabbit/Kafka/BullMQ/Redis para jobs.
- Un solo deploy (DB + API) y el flujo es muy fácil de auditar en tablas.

No es el patrón ideal para volúmenes masivos “de verdad”, pero es perfecto para demostrar:

- triggers,
- idempotencia básica por filas,
- paralelismo con SKIP LOCKED,
- DLQ.

## 4. Motor de riesgo por país (Strategy pattern)

### 4.1 Strategy pattern

En vez de meter `if country == 'MX' ...` por todo el código, se usa una **estrategia por país**:

- `RiskStrategyRegistryService` decide qué estrategia usar según `Country.code`.
- Cada estrategia implementa `evaluate(...)` y devuelve métricas + decisión.

Países implementados hoy (para el “core” del reto):

- **MX** y **PT**: reglas simplificadas basadas en dos ratios:
  - DTI (deuda/ingreso del banco mock).
  - `requestedAmount / monthlyIncome` (monto solicitado / ingreso declarado).

Nota: **MX y PT hoy comparten los mismos thresholds** (intencionalmente) para demostrar el mecanismo multi-país sin crecer demasiado en complejidad.

### 4.2 Proveedores bancarios (mock) por país

`BankProviderRegistryService` resuelve un “proveedor” por país (mock) y devuelve un `bankSnapshot` usado por el motor.

Esto separa claramente:

- “cómo obtengo datos del banco” (provider)
- “cómo evalúo el riesgo” (strategy)

### 4.3 `country_rules` para tunear sin tocar código

Existe una tabla `country_rules` versionada y con flags de “activa” para:

- ajustar umbrales (DTI, ratios, mínimos),
- y permitir que la estrategia use esos valores sin recompilar.

**Estado actual**:

- el seeder genera las reglas y los valores en la estrategias activas
- mientras que otras estrategias hoy ignoran algunos campos (quedaron como base para iteraciones futuras).

## 5. Cache in-memory y puerto para Redis

### 5.1 `CachePort` (port/adapter explicado)

`CachePort` es una interfaz mínima (`get/set/del/reset`). Hoy hay un adapter in-memory (`InMemoryCacheService`).

¿Para qué sirve esto?

- La lógica de negocio no depende de Redis/Memory directamente.
- En el futuro se puede implementar `CachePort` con Redis sin cambiar el resto del código.

### 5.2 Qué se cachea hoy (y TTL)

- `GET /countries` (activos): TTL ~ **5 min**.
- `GET /tenants` (lista): TTL ~ **120 s**.
- `GET /applications/:id` (detalle + último risk): TTL ~ **60 s**.

### 5.3 Invalidación

Invalidación (simple) basada en escrituras:

- Al crear un tenant se borra `tenants:all`.
- Al persistir un riesgo (`CreditApplicationRiskService`) se borra `application:<tenantId>:<applicationId>`.
- Al actualizar el estado desde el webhook mock también se borra `application:<tenantId>:<applicationId>`.

Deuda técnica: el update manual de estado (`PATCH /applications/:id/status`) **no invalida** el cache del detalle hoy, así que el TTL puede esconder el cambio por hasta ~60s.

## 6. Webhooks y procesos externos

### 6.1 Endpoint mock inbound

Existe un endpoint público (mock) que simula que un partner recibe un webhook:

- `POST /mock/partner/webhooks/applications/:applicationId/risk-updated`

Este endpoint:

- guarda un registro en `webhook_deliveries` (request/headers/URL),
- y lo marca como `SUCCESS` con respuesta `{ ok: true }`.

### 6.2 Qué está implementado vs qué queda pendiente

Implementado:

- Persistencia de deliveries con trazabilidad (incluye `idempotency_key` y snapshot de headers).
- Listado/admin debug: `GET /webhook-deliveries` y `GET /webhook-deliveries/:id`.

Pendiente (para hacerlo “production-like”):

- retries reales (usar `status=SENT/FAILED`, backoff, max attempts).
- idempotencia estricta (rechazar duplicados por `idempotency_key`).
- manejo robusto de errores del outbound (capturar status/body, reintentar, DLQ para webhooks).
- circuit break para abrir el circuito en caso de degradacion de servicios externos.

## 7. Actualización casi en tiempo real (polling)

### 7.1 Por qué polling (y no Socket.IO / SSE)

Se eligió polling por simplicidad y porque:

- es fácil de entender,
- fácil de debuggear (solo HTTP),
- y suficiente para mostrar “near realtime” en una prueba.

### 7.2 Qué se refresca y cada cuánto

En el frontend:

- Lista de solicitudes (`GET /applications`): cada **5s**.
- Tabla DLQ (`GET /applications/risk-evaluations/dlq`): cada **10s**.

### 7.3 Evitar problemas de caché/304 en el navegador

Las llamadas de polling que más se repiten (`/applications` y `/applications/risk-evaluations/dlq`) envían headers:

- `Cache-Control: no-cache`
- `Pragma: no-cache`

Motivo: algunos navegadores pueden responder `304 Not Modified` y Axios trata `304` como error; con esos headers evitamos esa situación.

## 8. Tradeoffs y alternativas consideradas

### Multi-tenant (columna `tenant_id`)

- **Pros**
  - Simple de entender y auditar en SQL.
  - Permite compartir DB sin duplicar infraestructura.
  - Monitorear y comparar tenants
- **Contras**
  - Requiere disciplina: nunca olvidar filtrar por tenant.
  - En sistemas muy grandes, puede requerir particionado/sharding.

### Cola en DB (`async_jobs` + trigger)

- **Pros**
  - Muy simple de desplegar (solo Postgres).
  - Trazabilidad total del flujo (PENDING/RUNNING/DONE/DLQ).
  - Paralelismo seguro con `FOR UPDATE SKIP LOCKED`.
- **Contras**
  - No es ideal para millones de jobs/día (contención, mantenimiento, bloat).
  - Menos features que colas dedicadas (delayed jobs, retries avanzados, etc.).
  - En producción probablemente migraría a una cola dedicada (Rabbit/Kafka).

### Cache in-memory (`CachePort`)

- **Pros**
  - Perfecto para la demo y fácil de razonar.
  - Acelera lecturas repetidas sin complejidad extra.
- **Contras**
  - No se comparte entre pods/instancias.
  - Requiere invalidación cuidadosa (hoy hay una invalidación parcial en algunos flujos).
  - En producción: reemplazar por Redis manteniendo la misma interfaz.

### Webhooks (mock + persistencia)

- **Pros**
  - Muestra trazabilidad y cómo modelar integración externa.
  - Tabla `webhook_deliveries` deja el camino listo para retries/idempotencia.
- **Contras**
  - Hoy el “partner” es un endpoint interno mock (no un tercero real).
  - Falta robustez de outbound (await, manejo de status/errores, reintentos).

### Polling en frontend

- **Pros**
  - Fácil de implementar y revisar.
  - Evita complejidad de sockets/SSE en una prueba.
- **Contras**
  - Más tráfico (requests periódicos).
  - Menos inmediato que un canal push.
  - En producción: SSE/Socket.IO o eventos (pub/sub) para “push real”.
