## In-memory cache (demo)

This project includes a very small in-memory cache adapter to reduce repeated DB reads without introducing Redis.

- **Interface**: `src/cache/cache.port.ts` (`CachePort` + `CACHE_PORT` token)
- **Adapter**: `src/cache/in-memory-cache.service.ts`
- **Module**: `src/cache/cache.module.ts`

### Endpoints using cache

- **GET `/countries`**: caches active countries (`countries:active`) for **5 minutes**
- **GET `/tenants`**: caches tenant catalog (`tenants:all`) for **120 seconds**
- **GET `/applications/:id`**: caches application detail + latest risk result (`application:${tenantId}:${applicationId}`) for **60 seconds**

### Invalidation pattern

- **Tenants**: `createTenant()` deletes `tenants:all`
- **Applications**:
  - `updateStatus()` deletes `application:${tenantId}:${applicationId}`
  - `evaluateAndPersistForApplication()` (async job worker path) deletes `application:${tenantId}:${applicationId}`

### Swap to Redis later

The adapter is intentionally behind `CachePort`. In production this would be backed by Redis using the same interface.

