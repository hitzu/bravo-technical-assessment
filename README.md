# Bravo – Technical Assessment

Sistema de evaluación de solicitudes de crédito multi-tenant, con:

- Backend en **NestJS + TypeORM + PostgreSQL**
- Frontend en **React + Vite + Mantine**
- **Multi-tenant + RBAC (ADMIN / AGENT)**
- **Procesamiento asíncrono** con cola en Postgres (`async_jobs`) y worker
- **Motor de riesgo** por país con estrategia pluggable
- **Cache in-memory** detrás de una interfaz (`CachePort`)
- **Webhooks mock** para simular un proveedor externo

El objetivo es mostrar cómo diseñaría e implementaría un sistema de este tipo en un contexto de prueba técnica, priorizando claridad, trazabilidad y extensibilidad.

---

## 1. Stack

### Backend

- Node.js 22
- NestJS 11
- TypeORM + PostgreSQL
- nestjs-pino (logging)
- class-validator / class-transformer
- Jest (unit tests)

### Frontend

- React 19
- Vite
- Mantine UI
- Axios

### 1.1. Documentación (para el revisor)

- `docs/technical assessment.md`: enunciado oficial de la prueba.
- `docs/data_model.ts`: modelo de datos (ER + explicación tabla por tabla).
- `docs/technical_decisions.md`: decisiones técnicas y tradeoffs (multi-tenant, cola en Postgres, strategy por país, cache, webhooks, polling).
- `docs/future_work.md`: escalabilidad, grandes volúmenes e ideas de trabajo futuro.
- `docs/design doc.md`: diseño detallado (más largo; útil si quieres profundizar).

## 2. Cómo correr el proyecto en local

### 2.1. Prerrequisitos

- Node 22 https://nodejs.org/es/download
- pnpm https://pnpm.io/installation
- Docker + Docker Compose

      - Mac https://www.docker.com/products/docker-desktop/ + https://docs.docker.com/desktop/setup/install/mac-install/
      - Windows https://www.docker.com/products/docker-desktop/ + https://docs.docker.com/desktop/setup/install/windows-install/
      - Linux: https://docs.docker.com/engine/install/ + https://docs.docker.com/compose/install/linux/

### 2.1 Instala dependencias

```bash
pnpm install
```

### 2.2. Levantar PostgreSQL

En la raíz del repo:

```bash
docker compose up -d
```

Esto levanta dos bases:

- Dev: `bravo_dev` en `localhost:57432`

- Test: `bravo_test` en `localhost:57433`

### 2.3. Variables de entorno

Usamos `.env.${NODE_ENV}`:

```bash
pnpm dlx shx cp .env.example .env.local
```

- Desarrollo: `.env.local`

- Tests: `.env.test`

Como base:

```bash
# .env.local
NODE_ENV=local

DB_HOST=localhost
DB_PORT=57432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=bravo_dev

ASYNC_JOBS_CRON_ENABLED=true
ASYNC_JOBS_CRON_LIMIT=10

# URL base para el “partner” mock (webhook)
PARTNER_BASE_URL=http://localhost:3000
```

### 2.4. Instalar dependencias + migraciones + seeds

```bash
pnpm install

# Migraciones
pnpm db:run

# Seeds de datos de demo (countries + rules, etc.)
pnpm seed:dev-data
```

### 2.5. Correr backend y frontend

Backend:

```bash
pnpm dev   # NestJS en http://localhost:3000
```

Frontend:

```bash
pnpm dev:front  # Vite en http://localhost:5173
```

- Swagger: `http://localhost:3000/api`

- Front: `http://localhost:5173`

---

## 3. Backend – Overview

### 3.1. Autenticación y RBAC

Auth “dev” basada en un token:

DEV.v1.{tenantId}.{userId}.{role}.{timestamp}

Este token se registra en la tabla token y se puede revocar (soft-delete).

Un guard global (DevTokenGuard) se encarga de:

Leer el Authorization: Bearer ...

Validar formato

Verificar en DB que el token siga activo

Inyectar en el contexto:

tenantId

userId

role (ADMIN | AGENT)

RBAC:

ADMIN puede ver todas las solicitudes del tenant y actualizar status.

AGENT solo ve sus propias solicitudes (createdBy = userId).

GET /users se dejó público a propósito para la demo: así el evaluador puede listar usuarios y loguearse como cualquiera desde el frontend.
En entorno real, /users estaría protegido y scopiado por tenant.

3.2. Entidades principales

tenants

users

token

countries

country_rules

credit_applications

application_risk_results

async_jobs

webhook_deliveries

Multi-tenant

Las entidades relevantes (por ejemplo, credit_applications, async_jobs, application_risk_results) llevan:

tenantId como columna obligatoria

Todas las queries de aplicación se filtran por tenantId del token

3.3. Endpoints principales

Auth (/auth)

POST /auth/signup (public) – Crea usuario de demo y devuelve token dev.

POST /auth/login (public) – Devuelve token dev según userId o elegido aleatoriamente.

POST /auth/logout – Revoca el token actual.

Tenants (/tenants)

POST /tenants (public demo)

GET /tenants (public demo)

Users (/users)

GET /users – Público solo para facilitar la demo (selector de usuario/rol).

Resto de métodos (POST, PATCH, DELETE, GET /:id) protegidos.

Countries (/countries)

GET /countries – Lista países activos.

GET /countries/:code – Detalle por código (ES, MX, etc.).

Credit Applications (/applications)

POST /applications

Crea una nueva solicitud con status inicial PENDING.

El tenantId viene del token.

Lanza un trigger en DB que inserta un job RISK_EVAL en async_jobs.

GET /applications

ADMIN: ve todas las solicitudes del tenant.

AGENT: ve solo las creadas por él.

Filtros: countryId, status, page, pageSize.

GET /applications/:id

Detalle de la solicitud.

Incluye el último ApplicationRiskResult si existe.

Respuesta cacheada 60s.

PATCH /applications/:id/status

Solo ADMIN.

Valida transiciones mínimas (no cambiar arbitrariamente entre terminales).

Jobs (/jobs)

POST /jobs/process?limit=N

Procesa jobs PENDING → RUNNING → DONE/DLQ.

ADMIN only.

Útil si el cron está deshabilitado.

Webhooks mock (/mock/partner/... y /webhook-deliveries)

POST /mock/partner/webhooks/applications/:applicationId/risk-updated

Endpoint inbound que simula un proveedor externo.

Persiste entradas en webhook_deliveries.

GET /webhook-deliveries

GET /webhook-deliveries/:id

4. Procesamiento asíncrono y motor de riesgo
   4.1. Cola async_jobs + trigger

Tabla async_jobs con:

id, tenantId, type, payload, status, attempts, lastError, processedAt, timestamps.

Enum ASYNC_JOB_TYPE (ej. RISK_EVAL).

Enum ASYNC_JOB_STATUS (PENDING, RUNNING, DONE, DLQ).

Trigger en DB:

AFTER INSERT en credit_applications:

Inserta en async_jobs un job RISK_EVAL con payload { applicationId: NEW.id }.

4.2. Worker

Servicio AsyncJobsProcessorService:

Selecciona jobs PENDING con:

FOR UPDATE SKIP LOCKED

→ Permite correr múltiples workers en paralelo sin pisarse.

Lógica:

Cambia job a RUNNING, incrementa attempts.

Recupera credit_application y evalúa si existe ApplicationRiskResult.

Invoca el servicio de riesgo para evaluar y persistir.

Marca el job como:

DONE si todo va bien.

DLQ si supera MAX_ATTEMPTS o si encuentra errores críticos (por ejemplo, aplicación inexistente).

Cron opcional:

ASYNC_JOBS_CRON_ENABLED=true → corre automáticamente cada segundo.

También se puede ejecutar manualmente vía POST /jobs/process.

4.3. Motor de riesgo por país (Strategy pattern)

CountryRule (country_rules) almacena configuración por país y versión:

Ej.: umbrales de DTI, flags de revisión, etc.

BankProviderRegistryService:

Según Country.code elige un proveedor:

ES → EsBankProvider (faker)

MX → MxBankProvider (faker)

RiskStrategyRegistryService:

Según Country.code elige una estrategia de riesgo:

ES → EsRiskStrategy

MX → MxRiskStrategy

Otros → DefaultRiskStrategy (por ahora más limitada)

Cada estrategia:

Recibe:

Datos de la aplicación.

Snapshot bancario simulado.

Reglas activas (CountryRule).

Devuelve:

riskScore

decision (APPROVE, REJECT, REVIEW)

debtToIncomeRatio u otras métricas.

El resultado se persiste en application_risk_results y se enlaza con la solicitud.

4.4. Reglas de riesgo (simplificadas, MX/ES)

Para que el revisor pueda razonar el resultado “a ojo”, las estrategias de MX/ES usan reglas basadas en dos ratios:

- DTI (debt-to-income): totalDebt / bankMonthlyIncome
- requestedRatio: requestedAmount / declaredMonthlyIncome

MX:

- Severidad por DTI:
  - APPROVE si DTI < 0.25
  - REJECT si DTI > 0.60
  - si no, REVIEW
- Severidad por requestedRatio:
  - APPROVE si requestedRatio <= 0.30
  - REVIEW si 0.30 < requestedRatio <= 0.80
  - REJECT si requestedRatio > 0.80
- Decisión final: peor severidad entre ambas (worstSeverity).

ES:

- Solo usa DTI:
  - APPROVE si DTI < 0.30
  - REVIEW si 0.30 <= DTI <= 0.60
  - REJECT si DTI > 0.60
- Hook opcional: si existe countryRule.requestedAmountReviewThreshold y requestedAmount lo excede, se degrada APPROVE → REVIEW.

Ejemplos (intuitivos):

| País | bankMonthlyIncome | totalDebt | requestedAmount | DTI  | requestedRatio | Decisión |
| ---- | ----------------- | --------- | --------------- | ---- | -------------- | -------- |
| MX   | 50,000            | 8,000     | 5,000           | 0.16 | 0.10           | APPROVE  |
| MX   | 50,000            | 12,000    | 35,000          | 0.24 | 0.70           | REVIEW   |
| MX   | 7,000             | 3,000     | 30,000          | 0.43 | 4.29           | REJECT   |

5. Cache

Interfaz CachePort con un adapter in-memory.

GET /countries: TTL ~5 min.

GET /tenants: TTL ~120s.

GET /applications/:id: TTL ~60s.

Invalidación simple:

En operaciones de escritura relevantes se invalidan las claves afectadas.

La implementación está pensada para sustituirse fácilmente por Redis en un entorno real.

6. Webhooks y simulación de partner

Para mostrar integración externa:

El worker, tras evaluar riesgo, llama a un endpoint mock de partner:

POST /mock/partner/webhooks/applications/:applicationId/risk-updated

Este endpoint:

Guarda un registro en webhook_deliveries.

Hoy marca el delivery como SUCCESS (200 OK) como parte del mock.

Es un lugar claro para:

Idempotencia.

Retries.

DSL de auditoría de “qué vio el partner y cuándo”.

---

## 7. Cómo usar el sistema (tutorial para el revisor)

La idea es que puedas ver el flujo end-to-end sin conocer NestJS.

### 7.1. Abrir el frontend

- Abrí `http://localhost:5173`

### 7.2. Elegir usuario y loguearse (sin fricción)

1. En la pantalla de login, el frontend llama a **`GET /users`** (público, solo demo) para poblar el selector.
2. Elegí un usuario con rol **`ADMIN`** (para poder hacer override de estados y procesar jobs manualmente).
3. El frontend hace **`POST /auth/login`** con el `userId` elegido.
4. El token dev se guarda como `authToken` en `localStorage` y se envía en cada request como `Authorization: Bearer ...`.

### 7.3. Crear solicitudes y “forzar” decisiones (MX / PT)

1. En “Crear solicitud de crédito” completá:
   - País: **MX** o **PT** (ambos usan reglas de ratio deuda/ingreso + monto/ingreso).
   - Ingreso mensual (monthlyIncome) y cantidad solicitada (requestedAmount).
2. Para ver decisiones distintas de forma intuitiva:
   - **APPROVE**: `requestedAmount` bajo en relación a `monthlyIncome` (por ejemplo ratio ~0.10) y DTI bajo.
   - **REVIEW**: valores intermedios (por ejemplo ratio ~0.70).
   - **REJECT**: ratio muy alto (por ejemplo > 0.80) o DTI alto.

### 7.4. Ver la cola `async_jobs` en acción

Cuando creás una solicitud:

- Postgres encola automáticamente un job `RISK_EVAL` en `async_jobs` (trigger `AFTER INSERT`).

El procesamiento ocurre de dos formas:

- **Automático**: si `ASYNC_JOBS_CRON_ENABLED=true`, el worker procesa jobs periódicamente.
- **Manual (debug)**: desde Swagger (`http://localhost:3000/api`) podés llamar **`POST /jobs/process?limit=10`** (requiere ADMIN).

### 7.5. Ver el resultado de riesgo y el estado

1. En la tabla “Solicitudes de crédito”, hacé click en “Ver detalle”.
2. El detalle muestra:
   - el estado actual (`PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `ERROR`),
   - el último resultado de riesgo (decision + ratios + `rawBankSnapshot`).

El frontend refresca la lista por **polling** cada ~5s para simular “near realtime”.

### 7.6. Ver DLQ y cómo llenarla con `forceRiskFailure`

1. Al crear una solicitud, marcá el checkbox **“Forzar fallo de riesgo”**.
2. El worker marcará el job como `DLQ` y la solicitud como `ERROR`.
3. En el frontend, revisá “Jobs en DLQ” (polling ~10s). El endpoint detrás es **`GET /applications/risk-evaluations/dlq`**.

### 7.7. Ver un webhook registrado en `webhook_deliveries`

Cuando el worker procesa un `RISK_EVAL`, también llama al endpoint mock:

- `POST /mock/partner/webhooks/applications/:applicationId/risk-updated`

Eso persiste un registro en `webhook_deliveries`. Para verlo:

1. Abrí Swagger (`http://localhost:3000/api`)
2. Llamá **`GET /webhook-deliveries`** (requiere ADMIN)
3. Opcional: `GET /webhook-deliveries/:id` para ver request/headers/response.

4. Validaciones – Cómo funcionan
   8.1. Nivel DTO (HTTP)

Se usa class-validator + ValidationPipe global:

whitelist: true → elimina campos desconocidos.

forbidNonWhitelisted: true → error si viene algo que no está en el DTO.

transform: true → convierte tipos (strings → numbers/booleans) según el DTO.

Ejemplos típicos (no pegados aquí, pero presentes en el repo):

CreateCreditApplicationDto:

amount y monthlyIncome numéricos y positivos.

countryId como UUID válido.

ChangeStatusDto:

status restringido al enum CREDIT_APPLICATION_STATUS.

8.2. Nivel dominio / servicio

Validaciones adicionales en el servicio:

Comprobar que el tenantId de la solicitud coincide con el del token.

Validar que el rol tenga permiso para la operación (ADMIN vs AGENT).

Validar transiciones de estado (no saltar de REJECTED a APPROVED de golpe, etc.).

Lógica de negocio del risk engine (por ejemplo, thresholds por país).

8.3. Nivel base de datos

Constraints en DB:

FKs (tenantId, countryId, etc.).

Unicidad donde aplica.

Enums (USER_ROLES, CREDIT_APPLICATION_STATUS, ASYNC_JOB_STATUS, etc.).

El trigger garantiza que toda nueva solicitud tiene su job RISK_EVAL encolado.

8.4. Per-country document validation

El `documentId` se valida al crear una solicitud (`POST /applications`) según el país seleccionado.

- **Dónde vive la regla**: `countries.document_label` y `countries.document_regex_pattern`.
- **Cómo se aplica**: en `CreditApplicationsService.createApplication` (antes de persistir/enqueue).
- **Importante**: los patrones son **simplificados para la prueba técnica** (sanity checks), no validación oficial “production-grade”.

9. Cómo agregar un nuevo país (paso a paso)

Supongamos que queremos agregar Chile (CL).

Agregar el país al catálogo

Insertar en tabla countries (o usar un seed/migración):

code = 'CL'

name = 'Chile'

status = ACTIVE

Agregar reglas de país (country_rules)

Insertar una fila en country_rules con:

country_id (FK al país recién creado)

version = 1

is_active = true

Campos de regla que definiste (por ejemplo, thresholds de DTI, flags de revisión).

La idea es que los ajustes finos se hagan vía esta tabla sin tocar código:

Ej.: DTI máximo, límites de monto, flags de “requires manual review”, etc.

Implementar un Bank Provider para ese país

Crear una clase ClBankProvider (similar a EsBankProvider / MxBankProvider), que devuelva datos simulados de deuda/productos:

totalDebt

numberOfLoans

etc.

Registrar el provider en BankProviderRegistryService bajo el código 'CL'.

Implementar una Risk Strategy específica (opcional pero recomendado)

Crear ClRiskStrategy implementando la interfaz de estrategias de riesgo:

Recibe:

Datos de la aplicación.

Snapshot de banco.

CountryRule activo.

Calcula:

riskScore

decision (APPROVE, REJECT, REVIEW)

métricas intermedias (DTI, ratios propios del país).

Registrar la estrategia en RiskStrategyRegistryService para el código 'CL'.

(Opcional) Validador de documento

Si necesitas validar un identificador (RUT, etc.), puedes:

Añadir un validador específico en el DTO (ej. @Matches(...)).

O encapsular la validación en una helper por país y llamarla desde el servicio.

Probar

Crear una CreditApplication con countryId de CL.

Ver que:

Se encola un job RISK_EVAL.

El worker lo procesa.

Se crea un ApplicationRiskResult con la lógica de CL.

El front refleja la solicitud y su resultado.

10. Notas de seguridad y PII

Token dev y /users público se dejaron así solo para el contexto de la prueba:

Facilita al evaluador loguearse como distintos roles/tenants sin fricción.

Datos personales / bancarios son mocks con Faker.

En un entorno real se endurecería:

RBAC completo en /users y /tenants.

Más control en logs (redactar PII).

Cifrado / tokenización de datos sensibles.

Config de CORS más estricta.

11. Trabajo futuro / extensiones

Si tuviera más tiempo, lo siguiente sería:

Añadir realtime (SSE / Socket.IO) para cambios de estado y resultados de riesgo.

Completar el flujo de webhooks outbound con payload real, retries y idempotencia.

Mejorar el catálogo de reglas por país y su UI de administración.

(Done) Manifiestos de Kubernetes (backend, worker, frontend, ingress). La base de datos se asume externa/managed.

(Done) `Makefile` / `Justfile` con comandos cortos (up, dev, test, etc.).

(Done) Documentación de escalabilidad (índices, particionado, consultas, archivado) en este README.

---

## Escalabilidad y manejo de grandes volúmenes de datos (análisis)

Esta sección quedó extraída a un documento dedicado para que el README sea más “navegable”.

- Ver: `docs/future_work.md`

Resumen de lo que cubre:

- índices recomendados por tabla (listados, “último resultado”, consumo FIFO-ish, auditoría),
- particionamiento/archivado,
- consultas críticas y patrones de acceso,
- colas y procesamiento masivo de jobs,
- cache distribuida y observabilidad.

## Despliegue en Kubernetes (referencia)

Esta carpeta existe para cumplir el requerimiento de la prueba técnica con manifiestos **básicos** (plain YAML, sin Helm/kustomize). No está pensado como un despliegue production-grade.

### Qué manifiestos existen

Viven en `infra/k8s/`:

- `namespace.yaml`: crea el namespace `bravo`.
- `configmap-backend.yaml`: config no sensible del backend (puerto, logs, flags de cron, etc.).
- `secret-backend.yaml`: secretos (placeholders) para DB y JWT (usa `stringData` a propósito para que sea legible en la revisión).
- `backend-deployment.yaml` + `backend-service.yaml`: API NestJS (2 réplicas) expuesta como `ClusterIP` en el puerto 3000.
- `worker-deployment.yaml`: worker para procesar jobs (reusa la misma imagen del backend y habilita el cron).
- `configmap-frontend.yaml`: `VITE_API_BASE_URL` (por defecto `/api` para funcionar detrás del Ingress).
- `frontend-deployment.yaml` + `frontend-service.yaml`: frontend (2 réplicas) expuesto como `ClusterIP` en el puerto 80.
- `ingress.yaml`: enruta HTTP:
  - `/api/*` → backend (con rewrite para quitar el prefijo `/api`)
  - `/` → frontend

### Asunciones importantes

- **Postgres es externo/managed**: NO se despliega Postgres en Kubernetes. El backend asume un Postgres accesible vía `DB_URL` (o `DB_HOST/DB_PORT/...`).
- **Imágenes placeholder**: los `image:` apuntan a nombres de ejemplo (p. ej. `ghcr.io/placeholder/...`). Deben reemplazarse por las imágenes reales construidas por CI.
- **No endurecido para producción**: faltan cosas típicas de prod (TLS, network policies, HPA, PodDisruptionBudgets, securityContext, etc.). Es una referencia para la evaluación.

### Cómo aplicarlo en un cluster de prueba

```bash
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/ -n bravo
```

Si usas Ingress (por ejemplo NGINX) y quieres probar el host placeholder:

- Añade `bravo.local` a tu `/etc/hosts` apuntando a la IP del Ingress Controller.

### Nota sobre el frontend y el API base URL

El frontend lee `VITE_API_BASE_URL` (ver `frontend/.env.example`). Para local sigue funcionando con el fallback `http://localhost:3000`, y para Kubernetes se recomienda `/api` (coincide con el `ingress.yaml`).
