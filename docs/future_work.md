# Escalabilidad, grandes volúmenes y trabajo futuro

Este documento responde específicamente a la parte de **“escalabilidad y manejo de grandes volúmenes”**, y deja un plan claro de:

- Qué ya está cubierto en el MVP.
- Qué haríamos para soportar **millones** de solicitudes / jobs.
- Qué mejoras técnicas y de producto tiene sentido abordar a continuación.

---

## 1. Índices recomendados

El modelo ya incluye varios índices pensados para los patrones de acceso actuales. Aquí se listan los más relevantes y qué añadir si el sistema crece.

### 1.1 `credit_applications` (lecturas más frecuentes)

Uso típico:

- Listado por tenant + filtros (país, estado) + orden por fecha.
- Listado “mis solicitudes” (AGENT) -> propuesta a cache.
- Detalle por `id`.

**Existe hoy**:

- `ix_credit_applications_tenant_status_created_at` en (`tenant_id`, `status`, `created_at` DESC).

**Recomendados si crece el volumen**:

- `(tenant_id, country_id, created_at DESC)`  
  Para listados frecuentes por país (por ejemplo, dashboard MX / PT / ES).
- `(tenant_id, created_by, created_at DESC)`  
  Para vistas de “mis solicitudes” con orden cronológico para agentes de call-center.
- `(tenant_id, id)`  
  Útil como índice auxiliar para joins y búsquedas directas por id dentro de cada tenant.

### 1.2 `application_risk_results`

Uso típico:

- Obtener el **último resultado de riesgo** por solicitud.

**Existe hoy**:

- `ix_application_risk_results_tenant_application` en (`tenant_id`, `application_id`).

**Recomendado si hay muchas reevaluaciones**:

- `(tenant_id, application_id, created_at DESC)`  
  Optimiza “dame el último resultado”, sobre todo si en el futuro se permiten reevaluaciones periódicas.

### 1.3 `async_jobs`

Uso típico:

- Consumo de jobs `PENDING` por orden de llegada.
- Debug por tenant + estado.
- Auditoría de jobs en `DLQ`.

**Existen hoy**:

- `ix_async_jobs_status_created` en (`status`, `created_at`).
- `ix_async_jobs_tenant_status` en (`tenant_id`, `status`).

**Recomendados si aumenta el throughput**:

- `(status, created_at, id)`  
  Para dar más estabilidad al orden cuando hay muchos jobs con timestamps similares.
- (futuro) índices parciales, por ejemplo:
  - `WHERE status = 'PENDING'`
  - `WHERE status = 'DLQ'`
    Si la mayoría de jobs ya están en `DONE` y solo unos pocos están activos.

### 1.4 `webhook_deliveries`

Uso típico:

- Auditoría por tenant y tipo de evento.
- Ver historial de webhooks por solicitud.

**Existen hoy**:

- `ix_webhook_deliveries_tenant_type_status` en (`tenant_id`, `type`, `status`).
- `ix_webhook_deliveries_tenant_application` en (`tenant_id`, `application_id`).

**Recomendados**:

- `(tenant_id, created_at DESC)`  
  Para dashboards “últimos eventos”.
- Índice/constraint para idempotencia (futuro):
  - índice único `(tenant_id, idempotency_key)` cuando `idempotency_key` no sea null.

---

## 2. Particionamiento y archivado

Si el sistema crece a decenas o cientos de millones de filas en tablas como:

- `credit_applications`
- `application_risk_results`
- `async_jobs`
- `webhook_deliveries`

es razonable planear **particionamiento** y **archivado**.

### 2.1 Particionado por tiempo `credit_applications.created_at`.

- Particiones mensuales o trimestrales.
- Beneficios:
  - índices más pequeños por partición,
  - VACUUM/ANALYZE más predecibles,
  - operaciones de mantenimiento (archivado/eliminación) discretas por rango de fechas.

Esquema típico:

- tabla padre `credit_applications`.
- particiones `credit_applications_2026_q1`, `credit_applications_2026_q2`, etc.

El código de aplicación cambia muy poco si se usa declarativamente; Postgres se encarga de enrutar las escrituras.

### 2.2 Particionado por tenant

Si hay algunos tenants gigantes (por ejemplo, un país o producto con muchísimos casos), otra opción es:

- Particionar por `tenant_id` o por hash de `tenant_id`.

Beneficios:

- Evita contención entre tenants grandes y pequeños.
- Permite mover físicamente particiones a diferentes discos/instancias.

En un escenario real, es común combinar:

- particionado por tiempo + (opcional) sub-particionado por tenant.

### 2.3 Archivado de históricos

Definir políticas de retención para auditoria y certificaciones:

- Por ejemplo:
  - solicitudes más viejas de 24 meses → mover a tablas de archivo.
  - resultados de riesgo > 36 meses → mover/compactar en “resúmenes” (por ejemplo, solo conservar agregados).

Opciones:

- Tablas `_archive` (con esquema idéntico, pero sin endpoints directos).
- Particiones antiguas marcadas como “cold storage” (otro tablespace, otro cluster, backup offline).

---

## 3. Consultas críticas y patrones de acceso

### 3.1 Listado de solicitudes (`GET /applications`)

Patrón actual:

- Filtro por `tenant_id`, optionally `status`, `country_id`.
- Orden por `created_at DESC`.
- Paginación por `page` + `pageSize` (offset/limit).

Para millones de filas:

- **Migrar a keyset pagination**:
  - En vez de `page`/`offset`, usar “desde este `(created_at, id)`”.
  - Evita que `OFFSET` de cientos de miles de filas penalice la consulta.
- Documentar en Swagger y en el frontend que el paginado es “hacia adelante/atrás” usando cursores simples.

### 3.2 DLQ y conciliación manual

La tabla `async_jobs` con `status = 'DLQ'` es crítica para:

- reintentos manuales,
- análisis de errores,
- reporting.

Recomendaciones:

- Indexar bien `status = 'DLQ'` y `tenant_id`.
- Añadir filtros por tipo de error (en columna `last_error` o estructura JSON futura).
- Tener scripts y/o endpoints internos que permitan:
  - “reencolar” jobs DLQ tras correcciones de datos.
  - descargar CSV/JSON para soporte.

---

## 4. Colas y procesamiento masivo de jobs

Hoy:

- Cola en Postgres (`async_jobs`).
- Trigger al insertar `credit_applications`.
- Worker en el mismo servicio NestJS.
- Reintentos simples con límite y DLQ.

Si el volumen de jobs crece enormemente (por ejemplo, integrándose con muchos proveedores, reevaluaciones periódicas, etc.), la siguiente iteración natural es:

### 4.1 Migrar a un job runner o message broker

- **BullMQ** sobre Redis:
  - Ideal para colas “operacionales” dentro del mismo ecosistema Node.
  - Permite:
    - reintentos con backoff,
    - prioridades,
    - retraso programado,
    - workers dedicados.

- **Message broker** (SQS/Kafka/Rabbit):
  - Desacopla aún más el sistema.
  - Mejora throughput y resiliencia.

El diseño actual facilita la migración:

- El trigger seguiría en DB, pero en vez de insertar en `async_jobs` podría publicar a una cola (vía “outbox pattern” o similar).
- El worker ya está encapsulado en un servicio; su loop podría cambiar de “SELECT ... SKIP LOCKED” a “consume mensajes de la cola”.

### 4.2 DLQ en broker dedicado

Igual que con la tabla, pero usando:

- dead-letter queues (SQS),
- tópicos de error (Kafka),
- o colas de error en BullMQ.

Se mantiene el mismo concepto:

- “jobs que fallaron varias veces o con input corrupto deben ir a un canal especial para inspección”.

---

## 5. Cache distribuida

Hoy:

- Implementación **in-memory** de `CachePort`.
- Cachee:
  - `GET /countries`.
  - `GET /tenants`.
  - `GET /applications/:id`.

Para entornos con múltiples pods/instancias:

### 5.1 Redis como cache centralizada

- Implementar `RedisCacheService` que cumpla `CachePort`.
- Configurar TTLs apropiados (segundos/minutos).
- Mantener las mismas claves que hoy:
  - `countries:active`
  - `tenants:all`
  - `application:<tenantId>:<applicationId>`

### 5.2 Invalidación más fina

Hoy la invalidación es “suficiente” para el MVP, pero no perfecta (hay casos en los que un cambio manual de estado puede tardar hasta 60s en verse).

En producción:

- invalidar explícitamente en cualquier escritura relevante:
  - cambio de estado manual,
  - procesamiento de riesgo,
  - recepción de webhook.
- considerar “eventos internos” (pub/sub) para invalidar caches en todos los pods.

---

## 6. Observabilidad avanzada

Hoy:

- logs estructurados (`nestjs-pino`),
- trazabilidad por tablas (`async_jobs`, `webhook_deliveries`).

Para producción:

### 6.1 Métricas

Algunos ejemplos útiles:

- Jobs:
  - jobs procesados/minuto,
  - jobs en `PENDING`/`RUNNING`/`DLQ`,
  - tiempo medio de procesamiento.
- Riesgo:
  - distribución de decisiones (`APPROVE/REVIEW/REJECT`) por país y tenant.
  - ratio `IN_REVIEW` que no se resuelven en X tiempo.
- Webhooks:
  - tasa de éxito/fallo,
  - latencia p95/p99 por endpoint externo.

### 6.2 Alertas

Umbrales típicos:

- DLQ creciente para cierto tipo de jobs.
- Tiempo de procesamiento > X minutos.
- Porcentaje de errores de webhook por encima de un umbral.
- Fallos de validación de documento por país (posible bug en reglas/regex).

## 7. Resumen

El MVP actual:

- Ya contempla multi-tenant, RBAC, cola de jobs, DLQ, cache y webhooks.
- Está pensado para ser fácil de correr y revisar (1 `docker-compose`, sin infra externa rara).

Escalarlo a millones de registros y entornos de producción implica:

- Afinar índices y patrones de paginación.
- Introducir particionado y archivado.
- Migrar la cola a un broker/job runner si el volumen lo requiere.
- Mover el cache a Redis y mejorar invalidaciones.
- Reforzar observabilidad (métricas, trazas, alertas).
- Completar la historia de producto (UI de reglas, dashboards, realtime).

El diseño actual deja estas puertas abiertas sin reescribir el core: la mayoría de los cambios se podrían hacer cambiando adaptadores (cola, cache, auth) y añadiendo nuevas capas (observabilidad, dashboards), sin romper los flujos clave de negocio.
