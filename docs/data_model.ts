const dataModelDoc = {
  mermaidErDiagram: `erDiagram
    tenants {
      uuid id PK
      text name
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    users {
      uuid id PK
      uuid tenant_id FK
      varchar email
      varchar full_name
      enum role
      enum status
      jsonb scopes
      timestamptz last_login_at
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    token {
      uuid id PK
      text token
      enum type
      uuid user_id FK
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    countries {
      uuid id PK
      char code
      varchar name
      enum status
      varchar document_label
      varchar document_regex_pattern
      varchar document_example
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    country_rules {
      uuid id PK
      uuid country_id FK
      int version
      bool is_active
      int document_min_length
      int document_max_length
      numeric dti_approve_max
      numeric dti_review_max
      numeric requested_amount_review_threshold
      numeric requested_amount_to_monthly_income_approve_max
      numeric requested_amount_to_monthly_income_review_max
      numeric min_monthly_income
      int min_risk_score_approve
      int min_risk_score_review
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    credit_applications {
      uuid id PK
      uuid tenant_id FK
      uuid created_by FK
      uuid country_id FK
      varchar full_name
      varchar document_id
      numeric monthly_income
      numeric requested_amount
      enum status
      jsonb bank_info
      boolean force_risk_failure
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    application_risk_results {
      uuid id PK
      uuid application_id FK
      uuid tenant_id FK
      uuid country_id FK
      numeric debt_to_income_ratio
      numeric requested_amount_to_monthly_income_ratio
      int risk_score
      enum decision
      jsonb raw_bank_snapshot
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    async_jobs {
      uuid id PK
      uuid tenant_id FK
      enum type
      jsonb payload
      enum status
      int attempts
      text last_error
      timestamptz processed_at
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    webhook_deliveries {
      uuid id PK
      uuid tenant_id FK
      uuid application_id FK
      enum type
      enum status
      varchar url
      jsonb request_body
      jsonb request_headers
      int response_status_code
      jsonb response_body
      text error_message
      int attempt_count
      varchar idempotency_key
      timestamptz delivered_at
      timestamptz created_at
      timestamptz updated_at
      timestamptz deleted_at
    }

    tenants ||--o{ users : "tenant_id"
    users ||--o{ token : "user_id (nullable)"

    countries ||--o{ country_rules : "country_id"

    tenants ||--o{ credit_applications : "tenant_id"
    users ||--o{ credit_applications : "created_by"
    countries ||--o{ credit_applications : "country_id"

    credit_applications ||--o{ application_risk_results : "application_id"
    tenants ||--o{ application_risk_results : "tenant_id"
    countries ||--o{ application_risk_results : "country_id"

    tenants ||--o{ async_jobs : "tenant_id"

    tenants ||--o{ webhook_deliveries : "tenant_id"
    credit_applications ||--o{ webhook_deliveries : "application_id"
`,
  description: `Este proyecto usa PostgreSQL con TypeORM, pero la idea del modelo es simple: todo lo “importante” está scopiado por tenant y gira alrededor de la solicitud de crédito.

### Multi-tenant (aislamiento por tenant)
- Las tablas que representan “objetos de negocio” llevan un \`tenant_id\` obligatorio: \`users\`, \`credit_applications\`, \`application_risk_results\`, \`async_jobs\`, \`webhook_deliveries\`.
- En runtime, el backend extrae el \`tenantId\` desde el token de demo (\`DEV.v1.<tenantId>.<userId>.<role>.<timestamp>\`) y lo usa para filtrar queries (por ejemplo, al listar o buscar una solicitud).
- Esto permite que distintos tenants compartan la misma base, sin mezclar datos.

### Procesamiento asíncrono (cola en Postgres)
- Al crear una solicitud (\`credit_applications\`) se dispara un trigger en DB que encola un job \`RISK_EVAL\` en \`async_jobs\`.
- Un “worker” (servicio en Nest) consume jobs \`PENDING\` en orden FIFO-ish (por \`created_at\`) usando \`FOR UPDATE SKIP LOCKED\`, que habilita paralelismo seguro con múltiples workers.
- Los jobs pasan por estados \`PENDING → RUNNING → DONE\` o \`DLQ\` (dead-letter queue) cuando fallan repetidamente o el input es inválido.

### Evaluación de riesgo (resultados versionables por solicitud)
- Cada evaluación genera un registro en \`application_risk_results\`. Esto sirve como historial/auditoría: una solicitud puede tener más de un resultado (por ejemplo si reevaluamos en el futuro).
- En la práctica, el frontend muestra “el último resultado” (ordenado por \`created_at\`).
- El resultado guarda métricas (DTI, ratio monto/ingreso), una decisión (\`APPROVE/REVIEW/REJECT\) y el snapshot “bancario” (mock) usado para calcular.

### Integración externa (registro de webhooks)
- \`webhook_deliveries\` guarda “intentos/entregas” de webhooks (request/headers/response/error) asociados a una solicitud.
- En esta demo existe un endpoint mock que simula un partner recibiendo un webhook de “riesgo actualizado”; cada llamada deja trazabilidad en esta tabla.
`,
  tables: {
    tenants: {
      summary:
        'Tenants (clientes/organizaciones) del sistema. Es la raíz del aislamiento multi-tenant.',
      importantColumns: ['id', 'name', 'created_at', 'deleted_at'],
      notes:
        'Muchos recursos del sistema (usuarios, solicitudes, jobs, webhooks) referencian a tenants vía `tenant_id`. En esta demo, endpoints de tenants están públicos para facilitar el uso por parte del revisor.',
    },
    users: {
      summary:
        'Operadores del sistema. Un usuario pertenece a un tenant y tiene un rol (ADMIN/AGENT).',
      importantColumns: [
        'id',
        'tenant_id',
        'email',
        'full_name',
        'role',
        'status',
        'scopes',
        'last_login_at',
      ],
      notes:
        'Restricciones/índices: `ux_users_tenant_email` (email único por tenant) y `ix_users_tenant_role` (acelera filtros por tenant + rol). En el flujo RBAC, `ADMIN` ve todas las solicitudes del tenant; `AGENT` solo las creadas por él (`credit_applications.created_by`).',
    },
    token: {
      summary:
        'Store de tokens de demo. El token dev se registra aquí para poder “revocarlo” (soft-delete).',
      importantColumns: ['id', 'token', 'type', 'user_id', 'created_at', 'deleted_at'],
      notes:
        'Importante: el formato del token (`DEV.v1...`) se parsea, pero además debe existir en esta tabla para ser válido. `user_id` es nullable: el store permite tokens sin owner, aunque el flujo normal lo registra ligado a un usuario.',
    },
    countries: {
      summary:
        'Catálogo de países. Define código (ES/MX/PT/...), estado (ACTIVE/INACTIVE) y metadatos de validación de documento.',
      importantColumns: [
        'id',
        'code',
        'name',
        'status',
        'document_label',
        'document_regex_pattern',
        'document_example',
      ],
      notes:
        'Índice `ix_countries_status` para listar activos. La validación del `document_id` al crear solicitudes usa `document_regex_pattern` (si existe) y muestra `document_label`/ejemplo en UI (demo).',
    },
    country_rules: {
      summary:
        '“Knobs” configurables por país para tunear reglas de riesgo sin cambiar código (versionado).',
      importantColumns: [
        'id',
        'country_id',
        'version',
        'is_active',
        'dti_approve_max',
        'dti_review_max',
        'requested_amount_review_threshold',
        'requested_amount_to_monthly_income_approve_max',
        'requested_amount_to_monthly_income_review_max',
        'min_monthly_income',
        'min_risk_score_approve',
        'min_risk_score_review',
      ],
      notes:
        'Restricción `ux_country_rules_country_version` (una versión por país) e índice `ix_country_rules_country_active` (buscar regla activa). Hoy el evaluador de riesgo recibe esta regla activa; algunas estrategias la usan (por ejemplo ES usa `requested_amount_review_threshold`).',
    },
    credit_applications: {
      summary:
        'Solicitud de crédito. Se crea vía API y es el centro del flujo: encola un job de evaluación de riesgo y luego se consulta/lista desde el frontend.',
      importantColumns: [
        'id',
        'tenant_id',
        'created_by',
        'country_id',
        'full_name',
        'document_id',
        'monthly_income',
        'requested_amount',
        'status',
        'bank_info',
        'force_risk_failure',
        'created_at',
      ],
      notes:
        'Índice `ix_credit_applications_tenant_status_created_at` para listados por tenant+estado. `bank_info` existe pero en la demo el “snapshot bancario” principal se guarda en `application_risk_results.raw_bank_snapshot`. `force_risk_failure` permite forzar DLQ/ERROR para la demo.',
    },
    application_risk_results: {
      summary:
        'Resultados de evaluación de riesgo. Guarda métricas, decisión y snapshot del “proveedor bancario” (mock) usado en el cálculo.',
      importantColumns: [
        'id',
        'application_id',
        'tenant_id',
        'country_id',
        'debt_to_income_ratio',
        'requested_amount_to_monthly_income_ratio',
        'risk_score',
        'decision',
        'raw_bank_snapshot',
        'created_at',
      ],
      notes:
        'Índice `ix_application_risk_results_tenant_application` para obtener el último resultado por solicitud. La decisión puede llevar a que la solicitud pase a `IN_REVIEW` automáticamente.',
    },
    async_jobs: {
      summary:
        'Cola en Postgres para trabajo asíncrono. Hoy contiene jobs de tipo `RISK_EVAL` generados por trigger al crear solicitudes.',
      importantColumns: [
        'id',
        'tenant_id',
        'type',
        'payload',
        'status',
        'attempts',
        'last_error',
        'processed_at',
        'created_at',
      ],
      notes:
        'Índices: `ix_async_jobs_status_created` (consumo FIFO-ish por estado+fecha) y `ix_async_jobs_tenant_status` (debug/filtrado por tenant). El worker marca jobs RUNNING y luego DONE o DLQ; DLQ retiene el `last_error` para inspección.',
    },
    webhook_deliveries: {
      summary:
        'Trazabilidad de webhooks (o intentos de integración externa). Permite auditar qué se “envió/recibió”, con request/response y estado.',
      importantColumns: [
        'id',
        'tenant_id',
        'application_id',
        'type',
        'status',
        'url',
        'request_body',
        'request_headers',
        'response_status_code',
        'response_body',
        'error_message',
        'attempt_count',
        'idempotency_key',
        'delivered_at',
        'created_at',
      ],
      notes:
        'Índices: `ix_webhook_deliveries_tenant_type_status` (auditoría) y `ix_webhook_deliveries_tenant_application` (ver historial por solicitud). En la demo se usa un endpoint mock que siempre marca SUCCESS; los estados SENT/FAILED quedan como base para completar retries/idempotencia más adelante.',
    },
  },
} as const;

export default dataModelDoc;
