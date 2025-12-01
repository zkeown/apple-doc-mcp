/**
 * Simple async mutex for preventing race conditions in concurrent operations.
 */
export class AsyncMutex {
	private locked = false;
	private readonly queue: Array<() => void> = [];

	/**
	 * Acquire the mutex lock. Returns a release function that must be called when done.
	 * If the mutex is already locked, this will wait until it becomes available.
	 */
	async acquire(): Promise<() => void> {
		if (!this.locked) {
			this.locked = true;
			return () => {
				this.release();
			};
		}

		return new Promise(resolve => {
			this.queue.push(() => {
				resolve(() => {
					this.release();
				});
			});
		});
	}

	private release(): void {
		const next = this.queue.shift();
		if (next) {
			next();
		} else {
			this.locked = false;
		}
	}
}

/**
 * Keyed mutex manager for per-key locking (e.g., per-technology locks).
 */
export class KeyedMutex {
	private readonly mutexes = new Map<string, AsyncMutex>();

	/**
	 * Acquire a lock for a specific key.
	 */
	async acquire(key: string): Promise<() => void> {
		let mutex = this.mutexes.get(key);
		if (!mutex) {
			mutex = new AsyncMutex();
			this.mutexes.set(key, mutex);
		}

		return mutex.acquire();
	}
}
