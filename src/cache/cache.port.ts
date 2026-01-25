export interface CachePort {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlMs?: number): void;
  del(key: string): void;
  reset(): void;
}

export const CACHE_PORT = Symbol('CACHE_PORT');

