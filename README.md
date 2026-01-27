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

---

## 2. Cómo correr el proyecto en local

### 2.1. Prerrequisitos

- Node 22
- pnpm
- Docker + Docker Compose

### 2.2. Levantar PostgreSQL

En la raíz del repo:

```bash
docker compose up -d

Esto levanta dos bases:

Dev: bravo_dev en localhost:57434

Test: bravo_test en localhost:57435

Nota: ajusté .env.example para que el DB_PORT coincida con 57434 (dev).

2.3. Variables de entorno

Usamos .env.${NODE_ENV}:

Desarrollo: .env.local

Tests: .env.test

Como base:

# .env.local
NODE_ENV=local

DB_HOST=localhost
DB_PORT=57434
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=bravo_dev

ASYNC_JOBS_CRON_ENABLED=true
ASYNC_JOBS_CRON_LIMIT=10

# URL base para el “partner” mock (webhook)
PARTNER_BASE_URL=http://localhost:3000

2.4. Instalar dependencias + migraciones + seeds
pnpm install

# Migraciones
pnpm db:run

# Seeds de datos de demo (countries + rules, etc.)
pnpm seed:dev-data

2.5. Correr backend y frontend

Backend:

pnpm dev   # NestJS en http://localhost:3000


Frontend:

pnpm dev:front  # Vite en http://localhost:5173


Swagger: http://localhost:3000/api

Front: http://localhost:5173

3. Backend – Overview
3.1. Autenticación y RBAC

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

| País | bankMonthlyIncome | totalDebt | requestedAmount | DTI | requestedRatio | Decisión |
|------|-------------------|-----------|-----------------|-----|----------------|---------|
| MX | 50,000 | 8,000 | 5,000 | 0.16 | 0.10 | APPROVE |
| MX | 50,000 | 12,000 | 35,000 | 0.24 | 0.70 | REVIEW |
| MX | 7,000 | 3,000 | 30,000 | 0.43 | 4.29 | REJECT |

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

Marca el delivery como SUCCESS o FAILED según el escenario.

Es un lugar claro para:

Idempotencia.

Retries.

DSL de auditoría de “qué vio el partner y cuándo”.

7. Frontend – Cómo probarlo

Flujo recomendado para el revisor:

Ir a http://localhost:5173.

En el selector de usuario, el frontend llama a GET /users (público) y muestra usuarios de demo.

Seleccionar un usuario ADMIN de un tenant.

El frontend hace POST /auth/login para ese userId.

Guarda el token dev en localStorage.

Una vez logueado:

Verás el tenant actual en el header.

Podrás:

Crear nuevas solicitudes.

Listar solicitudes con filtros (país, estado, etc.).

Ver detalle de una solicitud (incluyendo último resultado de riesgo).

Ver una tabla con entradas en DLQ.

El frontend refresca los datos usando polling (intervalos cortos) para simular “near realtime”.

8. Validaciones – Cómo funcionan
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
```

---

## Escalabilidad y manejo de grandes volúmenes de datos (análisis)

La solución está pensada para evolucionar hacia un sistema que puede manejar **millones** de solicitudes, manteniendo buen performance y permitiendo escalar horizontalmente.

### Índices recomendados (Postgres)

- **`credit_applications`** (lecturas más frecuentes):
  - `(tenant_id, status, created_at DESC)` para listados por estado (ya modelado como `ix_credit_applications_tenant_status_created_at`).
  - `(tenant_id, country_id, created_at DESC)` para filtros por país + orden por fecha.
  - `(tenant_id, created_by, created_at DESC)` para el scoping de AGENT (mis solicitudes).
- **`application_risk_results`**:
  - `(tenant_id, application_id, created_at DESC)` para “último resultado” por solicitud.
- **`async_jobs`**:
  - `(status, created_at)` para consumo FIFO-ish de jobs.
  - `(tenant_id, status)` si se aisla consumo por tenant (ya existe en migración).
- **`webhook_deliveries`**:
  - `(tenant_id, type, status, created_at DESC)` para auditoría y debug operacional.

### Particionado (cuando crezca)

Si `credit_applications` crece hacia decenas de millones:
- **Particionar por rango de tiempo** (mensual/trimestral) en `created_at` para mantener índices pequeños y acelerar queries por rango de fechas.
- Alternativa: **hash partitioning por `tenant_id`** si el acceso es predominantemente por tenant y los tenants son “grandes”.

### Consultas críticas y cómo evitar cuellos de botella

- **Listados**: preferir paginación con índices compuestos. Para grandes volúmenes, migrar de `offset/limit` a **keyset pagination** (por ejemplo usando `(created_at, id)`).
- **Detalle + último risk**: mantener el acceso por `(tenant_id, application_id)` y `created_at DESC`. Si se vuelve hot path, considerar materializar “último risk result id” en `credit_applications`.
- **Consumo de jobs**: `FOR UPDATE SKIP LOCKED` permite N workers en paralelo sin contención fuerte.

### Archivado / retención

- Definir retención por negocio (ej. 12–24 meses) y mover registros antiguos a:
  - tabla `credit_applications_archive`, o
  - particiones “frías” (detach) en storage más barato.
- (Opcional) comprimir/compactar JSONB grandes (`raw_bank_snapshot`, request/response bodies) o tokenizar/encriptar si fuese PII real.

### Caché

- Cachear catálogos (`/countries`, `/tenants`) y detalle (`/applications/:id`) con TTL.
- En un entorno multi-réplica, reemplazar in-memory por **Redis** (ya existe `CachePort`) y definir estrategia de invalidación basada en eventos/escrituras.

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
