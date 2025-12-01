import type {CacheEntry} from '../types/index.js';

/**
 * Generic in-memory LRU cache with TTL expiration.
 * Values are stored as unknown and type-cast on retrieval for flexibility.
 */
export class MemoryCache {
	private readonly cache = new Map<string, CacheEntry<unknown>>();
	private readonly cacheTimeout: number;
	private readonly maxSize: number;

	constructor(timeoutMs: number = 10 * 60 * 1000, maxSize = 100) { // Default 10 minutes, 100 entries max
		this.cacheTimeout = timeoutMs;
		this.maxSize = maxSize;
	}

	get<T>(key: string): T | undefined {
		const cached = this.cache.get(key);
		if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
			// Move to end to mark as recently used (LRU behavior)
			this.cache.delete(key);
			this.cache.set(key, cached);
			return cached.data as T;
		}

		// Clean up expired entry
		if (cached) {
			this.cache.delete(key);
		}

		return undefined;
	}

	set<T>(key: string, data: T): void {
		// If key already exists, delete it first (will be re-added at end)
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxSize) {
			// Evict the oldest entry (first key in Map) if at capacity
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey);
			}
		}

		this.cache.set(key, {
			data,
			timestamp: Date.now(),
		});
	}

	clear(): void {
		this.cache.clear();
	}

	get size(): number {
		return this.cache.size;
	}
}
