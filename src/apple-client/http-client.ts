import axios from 'axios';
import {config} from '../config.js';
import {createOperationLogger} from '../logger.js';
import {MemoryCache} from './cache/memory-cache.js';

/** HTTP headers for Apple documentation API requests */
const getHeaders = () => ({
	dnt: '1',
	referer: 'https://developer.apple.com/documentation',
	'User-Agent': config.http.userAgent,
});

export class HttpClient {
	private readonly cache: MemoryCache;

	/**
	 * Create an HttpClient with optional dependency injection.
	 * @param cache - Optional MemoryCache instance. If not provided, creates default.
	 */
	constructor(cache?: MemoryCache) {
		this.cache = cache ?? new MemoryCache(config.cache.ttlMs, config.cache.maxSize);
	}

	async makeRequest<T>(path: string, attempt = 1): Promise<T> {
		const url = `${config.http.baseUrl}/${path}`;
		const op = createOperationLogger('httpRequest', {url, attempt});

		// Simple cache check
		const cached = this.cache.get<T>(url);
		if (cached) {
			op.debug('Cache hit');
			return cached;
		}

		try {
			const {data} = await axios.get<T>(url, {
				headers: getHeaders(),
				timeout: config.http.timeoutMs,
			});

			// Validate response structure before caching
			// This prevents malformed responses from being cached and causing downstream errors
			this.validateResponse(data, url);

			// Cache the validated result
			this.cache.set(url, data);
			op.success();
			return data;
		} catch (error) {
			// Check if we should retry
			if (this.isRetryableError(error) && attempt < config.http.maxRetryAttempts) {
				const delayMs = config.http.baseRetryDelayMs * (2 ** (attempt - 1)); // Exponential backoff
				op.warn('Retrying request', {
					nextAttempt: attempt + 1,
					maxAttempts: config.http.maxRetryAttempts,
					delayMs,
				});
				await this.delay(delayMs);
				return this.makeRequest<T>(path, attempt + 1);
			}

			op.failure(error);
			throw new Error(`Failed to fetch documentation: ${error instanceof Error ? error.message : String(error)}`, {cause: error});
		}
	}

	async getDocumentation<T>(path: string): Promise<T> {
		return this.makeRequest<T>(`${path}.json`);
	}

	clearCache(): void {
		this.cache.clear();
	}

	private isRetryableError(error: unknown): boolean {
		if (!axios.isAxiosError(error)) {
			return false;
		}

		// IsAxiosError type guard already narrows the type, no cast needed
		const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'];
		if (error.code && retryableCodes.includes(error.code)) {
			return true;
		}

		// Retry on server errors (503 Service Unavailable, 429 Too Many Requests, 500 Internal Server Error)
		const status = error.response?.status;
		if (status === 503 || status === 429 || status === 500 || status === 502 || status === 504) {
			return true;
		}

		return false;
	}

	private async delay(ms: number): Promise<void> {
		return new Promise(resolve => {
			setTimeout(resolve, ms);
		});
	}

	/**
	 * Validate API response structure before caching.
	 * Ensures we got valid data and not an error response or malformed data.
	 * Note: Full schema validation should be done by callers using Zod schemas.
	 */
	private validateResponse<T>(data: T, url: string): void {
		// Check for null/undefined
		if (data === null || data === undefined) {
			throw new Error(`API returned null or undefined response for ${url}`);
		}

		// Check for non-object types (API should return JSON objects, not arrays or primitives)
		if (typeof data !== 'object' || Array.isArray(data)) {
			throw new TypeError(`API returned unexpected type '${Array.isArray(data) ? 'array' : typeof data}' for ${url}`);
		}

		const dataObj = data as Record<string, unknown>;

		// Check for empty objects (likely an error or missing resource)
		if (Object.keys(dataObj).length === 0) {
			throw new Error(`API returned empty object for ${url}`);
		}

		// Check for error responses from Apple API
		// Apple sometimes returns {error: ...} or {errors: [...]} on failure
		if ('error' in dataObj && dataObj.error) {
			const errorMsg = typeof dataObj.error === 'string' ? dataObj.error : 'Unknown API error';
			throw new Error(`API returned error: ${errorMsg}`);
		}

		if ('errors' in dataObj && Array.isArray(dataObj.errors) && dataObj.errors.length > 0) {
			const errorMsg = dataObj.errors.map((e: unknown) =>
				typeof e === 'string' ? e : 'Unknown error').join(', ');
			throw new Error(`API returned errors: ${errorMsg}`);
		}
	}
}
