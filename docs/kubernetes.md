# Despliegue en Kubernetes (K8s)

Este documento describe cómo se modelaría el despliegue de Bravo en un clúster de Kubernetes usando manifiestos YAML simples. No es un despliegue real, pero sirve como guía para entender:

- Qué componentes habría que desplegar.
- Qué variables de entorno/configuración necesitan.
- Cómo podría integrarse con un Ingress / Service.

> Nota: los nombres de archivos son sugeridos; no es obligatorio que existan todos en el repo si el alcance de la prueba no lo requiere.

---

## 1. Componentes principales

### 1.1 Backend API

Archivo sugerido: `k8s/backend-deployment.yaml`

- **Deployment** con 1–3 réplicas (escalable horizontalmente).
- Container con imagen del backend (por ejemplo, `bravo-backend:latest`).
- Variables de entorno:
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
  - `NODE_ENV=production`
  - Flags opcionales: `ASYNC_JOBS_CRON_ENABLED=true`, etc.
- **Liveness/Readiness probes** apuntando a `GET /health`.

Service asociado: `k8s/backend-service.yaml`

- Service tipo `ClusterIP` exponiendo el puerto HTTP (por ejemplo, 3000).
- Selector por labels (`app: bravo-backend`).

### 1.2 Worker de jobs

Archivo sugerido: `k8s/worker-deployment.yaml`

- Deployment que reutiliza la **misma imagen** del backend.
- Comando distinto, por ejemplo:
  - `command: ["node", "dist/main.js", "--worker-mode"]` o similar.
- Variables de entorno iguales a las del backend.
- Escalable independientemente (horizontalmente) según carga de jobs.

> Alternativa: usar un solo Deployment con 2 containers sidecar (no recomendado aquí) o un CronJob si el procesamiento fuera puramente batch.

### 1.3 Frontend

Archivo sugerido: `k8s/frontend-deployment.yaml`

- Deployment con imagen de la app de React ya buildada (`bravo-frontend:latest`), normalmente servida por un servidor estático (Nginx, etc.).
- Variables de entorno o `configMap` para:
  - `VITE_API_BASE_URL` apuntando al Service del backend (`http://bravo-backend:3000`).

Service asociado: `k8s/frontend-service.yaml`

- Service tipo `ClusterIP` exponiendo el puerto HTTP estático (por ejemplo, 4173 o 80).

### 1.4 Base de datos (Postgres)

En producción, lo habitual sería usar un servicio gestionado (RDS, Cloud SQL, etc.). Para un entorno demo:

Archivo sugerido: `k8s/postgres-statefulset.yaml`

- StatefulSet con 1 réplica de PostgreSQL.
- VolumeClaimTemplate para datos (`PersistentVolumeClaim`).
- Variables de entorno: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`.
- Service tipo `ClusterIP` (`bravo-postgres`) en el puerto 5432.

Backend/worker se conectarían a este Service vía `DB_HOST=bravo-postgres`.

---

## 2. Ingress / Exposición externa

Archivo sugerido: `k8s/ingress.yaml`

- Ingress que enruta:
  - `https://bravo.example.com/` → Service `bravo-frontend`.
  - `https://bravo.example.com/api` → Service `bravo-backend` (opcionalmente con `pathPrefix: /api`).

Dependiendo del cluster, se usaría:

- `IngressClassName` (por ejemplo, `nginx`, `traefik`, etc.).
- Cert-Manager para TLS automático (Let’s Encrypt).

---

## 3. Configuración y secretos

### 3.1 ConfigMaps

Archivo sugerido: `k8s/configmap.yaml`

Incluye configuración no sensible, por ejemplo:

- `NODE_ENV=production`
- `ASYNC_JOBS_CRON_ENABLED=true`
- `ASYNC_JOBS_CRON_LIMIT=50`
- `PARTNER_BASE_URL` (URL del sistema externo o mock que recibe webhooks).

### 3.2 Secrets

Archivo sugerido: `k8s/secrets.yaml`

Incluye datos sensibles:

- `DB_USER`, `DB_PASSWORD`
- Cualquier token de integración externa.

Los Deployments referencian estos valores via `envFrom`/`env`.

---

## 4. Estrategia de despliegue

Para un entorno sencillo:

- Desplegar Postgres (o apuntar a uno gestionado).
- Desplegar backend + worker.
- Desplegar frontend.
- Aplicar Ingress para exponerlos externamente.

Estrategias de rollout:

- `RollingUpdate` para backend y frontend (strategy por defecto).
- HPA opcional (Horizontal Pod Autoscaler) según CPU/RAM o métricas personalizadas (jobs en cola, etc.).

---

## 5. Integración con CI/CD

El workflow de GitHub Actions se puede extender para:

1. Compilar imágenes Docker de backend y frontend.
2. Publicarlas en un registry.
3. Aplicar los manifiestos K8s usando:
   - `kubectl apply -f k8s/`
   - o herramientas como Helm/Kustomize si se requiere más flexibilidad.

Por simplicidad, el reto actual se queda en el nivel de:

- tener los manifiestos básicos,
- y documentar cómo se usarían, sin levantar un cluster real en CI.
