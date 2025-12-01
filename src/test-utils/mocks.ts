import {vi} from 'vitest';
import type {AppleDevDocsClient} from '../apple-client.js';
import type {ServerContext} from '../server/context.js';
import {ServerState} from '../server/state.js';
import {
	mockTechnologies,
	mockSwiftUIFramework,
	mockViewSymbol,
} from './fixtures.js';

/**
 * Type for the methods we need to mock on AppleDevDocsClient
 */
export type MockClientMethods = {
	getTechnologies: ReturnType<typeof vi.fn>;
	getFramework: ReturnType<typeof vi.fn>;
	getSymbol: ReturnType<typeof vi.fn>;
	searchFramework: ReturnType<typeof vi.fn>;
	refreshFramework: ReturnType<typeof vi.fn>;
	refreshTechnologies: ReturnType<typeof vi.fn>;
	extractText: (abstract: Array<{text: string; type: string}> | undefined) => string;
	formatPlatforms: (platforms: Array<{name: string; introducedAt: string}> | undefined) => string;
};

/**
 * Creates a mock AppleDevDocsClient with sensible defaults.
 * All async methods are vi.fn() mocks that can be customized.
 */
export const createMockClient = (overrides: Partial<MockClientMethods> = {}): AppleDevDocsClient => {
	const defaults: MockClientMethods = {
		getTechnologies: vi.fn().mockResolvedValue(mockTechnologies),
		getFramework: vi.fn().mockResolvedValue(mockSwiftUIFramework),
		getSymbol: vi.fn().mockResolvedValue(mockViewSymbol),
		searchFramework: vi.fn().mockResolvedValue([]),
		refreshFramework: vi.fn().mockResolvedValue(mockSwiftUIFramework),
		refreshTechnologies: vi.fn().mockResolvedValue(mockTechnologies),
		extractText: abstract => abstract?.map(a => a.text).join('') ?? '',
		formatPlatforms: platforms =>
			platforms?.map(p => `${p.name} ${p.introducedAt}+`).join(', ') ?? '',
	};

	return {...defaults, ...overrides} as unknown as AppleDevDocsClient;
};

/**
 * Creates a test ServerContext with mock client and fresh state.
 */
export const createTestContext = (overrides: Partial<ServerContext> = {}): ServerContext => ({
	client: createMockClient(),
	state: new ServerState(),
	...overrides,
});

/**
 * Creates a ServerContext with an active technology already set.
 */
export const createContextWithTechnology = (technology = mockTechnologies['doc://com.apple.documentation/documentation/swiftui']): ServerContext => {
	const context = createTestContext();
	context.state.setActiveTechnology(technology);
	return context;
};

/**
 * Creates a mock client that throws errors for testing error handling.
 */
export const createErrorClient = (errorMessage = 'Mock error'): AppleDevDocsClient => createMockClient({
	getTechnologies: vi.fn().mockRejectedValue(new Error(errorMessage)),
	getFramework: vi.fn().mockRejectedValue(new Error(errorMessage)),
	getSymbol: vi.fn().mockRejectedValue(new Error(errorMessage)),
	searchFramework: vi.fn().mockRejectedValue(new Error(errorMessage)),
});

/**
 * Creates a mock client with custom technologies for pagination testing.
 */
export const createClientWithTechnologies = (technologies: Record<string, import('../apple-client/types/index.js').Technology>): AppleDevDocsClient => createMockClient({
	getTechnologies: vi.fn().mockResolvedValue(technologies),
});
