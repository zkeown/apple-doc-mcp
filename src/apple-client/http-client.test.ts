import {
	describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import axios, {type AxiosError, type AxiosResponse} from 'axios';
import {HttpClient} from './http-client.js';

// Mock axios
vi.mock('axios', () => ({
	default: {
		get: vi.fn(),
		isAxiosError: vi.fn(),
	},
}));

// Helper to create mock AxiosError-like objects
const createNetworkError = (code: string, message: string): Partial<AxiosError> => ({
	code,
	message,
	name: 'AxiosError',
	isAxiosError: true,
});

const createHttpError = (status: number, message: string): Partial<AxiosError> => ({
	message,
	name: 'AxiosError',
	isAxiosError: true,
	response: {status} as AxiosResponse,
});

describe('HttpClient', () => {
	let client: HttpClient;

	beforeEach(() => {
		client = new HttpClient();
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('makeRequest', () => {
		it('should fetch data successfully', async () => {
			const mockData = {name: 'test'};
			vi.mocked(axios.get).mockResolvedValueOnce({data: mockData});

			const result = await client.makeRequest<typeof mockData>('test/path');

			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(1);
		});

		it('should return cached data on subsequent requests', async () => {
			const mockData = {name: 'cached'};
			vi.mocked(axios.get).mockResolvedValueOnce({data: mockData});

			const result1 = await client.makeRequest<typeof mockData>('test/cached');
			const result2 = await client.makeRequest<typeof mockData>('test/cached');

			expect(result1).toEqual(mockData);
			expect(result2).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(1); // Only called once due to caching
		});

		it('should retry on ECONNRESET error', async () => {
			const networkError = createNetworkError('ECONNRESET', 'Connection reset');
			const mockData = {name: 'success'};

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get)
				.mockRejectedValueOnce(networkError)
				.mockResolvedValueOnce({data: mockData});

			const resultPromise = client.makeRequest<typeof mockData>('test/retry');

			// Advance timers to trigger retry
			await vi.advanceTimersByTimeAsync(500);

			const result = await resultPromise;
			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(2);
		});

		it('should retry on ETIMEDOUT error', async () => {
			const timeoutError = createNetworkError('ETIMEDOUT', 'Timeout');
			const mockData = {name: 'success'};

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get)
				.mockRejectedValueOnce(timeoutError)
				.mockResolvedValueOnce({data: mockData});

			const resultPromise = client.makeRequest<typeof mockData>('test/timeout');

			await vi.advanceTimersByTimeAsync(500);

			const result = await resultPromise;
			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(2);
		});

		it('should retry on 503 Service Unavailable', async () => {
			const serverError = createHttpError(503, 'Service Unavailable');
			const mockData = {name: 'recovered'};

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get)
				.mockRejectedValueOnce(serverError)
				.mockResolvedValueOnce({data: mockData});

			const resultPromise = client.makeRequest<typeof mockData>('test/503');

			await vi.advanceTimersByTimeAsync(500);

			const result = await resultPromise;
			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(2);
		});

		it('should retry on 429 Too Many Requests', async () => {
			const rateLimitError = createHttpError(429, 'Too Many Requests');
			const mockData = {name: 'success after rate limit'};

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get)
				.mockRejectedValueOnce(rateLimitError)
				.mockResolvedValueOnce({data: mockData});

			const resultPromise = client.makeRequest<typeof mockData>('test/429');

			await vi.advanceTimersByTimeAsync(500);

			const result = await resultPromise;
			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(2);
		});

		it('should NOT retry on 404 Not Found', async () => {
			const notFoundError = createHttpError(404, 'Not Found');

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get).mockRejectedValueOnce(notFoundError);

			await expect(client.makeRequest('test/404')).rejects.toThrow('Failed to fetch documentation');
			expect(axios.get).toHaveBeenCalledTimes(1); // No retry
		});

		it('should NOT retry on 400 Bad Request', async () => {
			const badRequestError = createHttpError(400, 'Bad Request');

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get).mockRejectedValueOnce(badRequestError);

			await expect(client.makeRequest('test/400')).rejects.toThrow('Failed to fetch documentation');
			expect(axios.get).toHaveBeenCalledTimes(1);
		});

		it('should retry on 500 Internal Server Error', async () => {
			const serverError = createHttpError(500, 'Internal Server Error');
			const mockData = {name: 'recovered'};

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get)
				.mockRejectedValueOnce(serverError)
				.mockResolvedValueOnce({data: mockData});

			const resultPromise = client.makeRequest<typeof mockData>('test/500');

			await vi.advanceTimersByTimeAsync(500);

			const result = await resultPromise;
			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(2);
		});

		it('should retry on 502 Bad Gateway', async () => {
			const gatewayError = createHttpError(502, 'Bad Gateway');
			const mockData = {name: 'recovered'};

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get)
				.mockRejectedValueOnce(gatewayError)
				.mockResolvedValueOnce({data: mockData});

			const resultPromise = client.makeRequest<typeof mockData>('test/502');

			await vi.advanceTimersByTimeAsync(500);

			const result = await resultPromise;
			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(2);
		});

		it('should retry on ECONNABORTED error', async () => {
			const abortedError = createNetworkError('ECONNABORTED', 'Connection aborted');
			const mockData = {name: 'success'};

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get)
				.mockRejectedValueOnce(abortedError)
				.mockResolvedValueOnce({data: mockData});

			const resultPromise = client.makeRequest<typeof mockData>('test/aborted');

			await vi.advanceTimersByTimeAsync(500);

			const result = await resultPromise;
			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(2);
		});

		it('should throw on null response data', async () => {
			vi.mocked(axios.get).mockResolvedValueOnce({data: null});

			await expect(client.makeRequest('test/null')).rejects.toThrow('API returned null or undefined response');
		});

		it('should throw on undefined response data', async () => {
			vi.mocked(axios.get).mockResolvedValueOnce({data: undefined});

			await expect(client.makeRequest('test/undefined')).rejects.toThrow('API returned null or undefined response');
		});

		it('should throw on non-object response data', async () => {
			vi.mocked(axios.get).mockResolvedValueOnce({data: 'string response'});

			await expect(client.makeRequest('test/string')).rejects.toThrow('API returned unexpected type');
		});

		it('should use exponential backoff for retries', async () => {
			const networkError = createNetworkError('ECONNRESET', 'Connection reset');
			const mockData = {name: 'success'};

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get)
				.mockRejectedValueOnce(networkError)
				.mockRejectedValueOnce(networkError)
				.mockResolvedValueOnce({data: mockData});

			const resultPromise = client.makeRequest<typeof mockData>('test/backoff');

			// First retry after 500ms (500 * 2^0)
			await vi.advanceTimersByTimeAsync(500);
			// Second retry after 1000ms (500 * 2^1)
			await vi.advanceTimersByTimeAsync(1000);

			const result = await resultPromise;
			expect(result).toEqual(mockData);
			expect(axios.get).toHaveBeenCalledTimes(3);
		});

		it('should throw after max retry attempts', async () => {
			const networkError = createNetworkError('ECONNRESET', 'Connection reset');

			vi.mocked(axios.isAxiosError).mockReturnValue(true);
			vi.mocked(axios.get).mockRejectedValue(networkError);

			// Catch the rejection immediately to prevent unhandled rejection warning
			let caughtError: unknown;
			const resultPromise = client.makeRequest('test/fail').catch((error: unknown) => {
				caughtError = error;
			});

			// Advance through all retry attempts
			await vi.runAllTimersAsync();
			await resultPromise;

			expect(caughtError).toBeDefined();
			expect(caughtError).toBeInstanceOf(Error);
			expect((caughtError as Error).message).toContain('Failed to fetch documentation');
			expect(axios.get).toHaveBeenCalledTimes(3); // Initial + 2 retries (default maxRetryAttempts)
		});

		it('should NOT retry non-axios errors', async () => {
			const genericError = new Error('Generic error');

			vi.mocked(axios.isAxiosError).mockReturnValue(false);
			vi.mocked(axios.get).mockRejectedValueOnce(genericError);

			await expect(client.makeRequest('test/generic')).rejects.toThrow('Failed to fetch documentation');
			expect(axios.get).toHaveBeenCalledTimes(1);
		});
	});

	describe('getDocumentation', () => {
		it('should append .json to path', async () => {
			const mockData = {documentation: true};
			vi.mocked(axios.get).mockResolvedValueOnce({data: mockData});

			await client.getDocumentation('documentation/swiftui');

			expect(axios.get).toHaveBeenCalledWith(
				expect.stringContaining('documentation/swiftui.json'),
				expect.any(Object),
			);
		});
	});

	describe('clearCache', () => {
		it('should clear cached data', async () => {
			const mockData = {name: 'test'};
			vi.mocked(axios.get).mockResolvedValue({data: mockData});

			await client.makeRequest('test/clear');
			client.clearCache();
			await client.makeRequest('test/clear');

			expect(axios.get).toHaveBeenCalledTimes(2); // Called twice after cache clear
		});
	});
});
