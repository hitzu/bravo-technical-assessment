import { Injectable } from '@nestjs/common';

import type { CachePort } from './cache.port';

type CacheEntry = {
  value: unknown;
  expiresAt?: number;
};

@Injectable()
export class InMemoryCacheService implements CachePort {
  private readonly store = new Map<string, CacheEntry>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (typeof entry.expiresAt === 'number' && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const expiresAt =
      typeof ttlMs === 'number' && ttlMs > 0 ? Date.now() + ttlMs : undefined;

    this.store.set(key, { value, expiresAt });
  }

  del(key: string): void {
    this.store.delete(key);
  }

  reset(): void {
    this.store.clear();
  }
}

