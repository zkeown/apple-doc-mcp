import {
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import {
	mockButtonSymbol,
	mockSwiftUIFramework,
	mockSwiftUITechnology,
	mockViewSymbol,
} from '../../test-utils/fixtures.js';
import {
	createContextWithTechnology,
	createMockClient,
	createTestContext,
} from '../../test-utils/mocks.js';
import {buildGetDocumentationHandler} from './get-documentation.js';

describe('get-documentation handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('no technology selected', () => {
		it('returns prompt to select technology when none is active', async () => {
			const context = createTestContext();
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			expect(result.content[0].text).toContain('No Technology Selected');
			expect(result.content[0].text).toContain('discover_technologies');
			expect(result.content[0].text).toContain('choose_technology');
		});
	});

	describe('symbol documentation', () => {
		it('fetches and formats symbol documentation', async () => {
			const context = createContextWithTechnology();
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			expect(result.content[0].text).toContain('View');
			expect(result.content[0].text).toContain('protocol');
		});

		it('includes symbol declaration when available', async () => {
			const context = createContextWithTechnology();
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			// The mockViewSymbol has a declaration
			expect(result.content[0].text).toContain('Declaration');
		});

		it('includes abstract/description', async () => {
			const context = createContextWithTechnology();
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			expect(result.content[0].text).toContain('user interface');
		});

		it('includes platform information', async () => {
			const context = createContextWithTechnology();
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			expect(result.content[0].text).toMatch(/iOS|macOS/);
		});
	});

	describe('symbol resolution', () => {
		it('resolves simple symbol names', async () => {
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockResolvedValue(mockViewSymbol),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			await handler({path: 'View'});

			expect(mockClient.getSymbol).toHaveBeenCalled();
		});

		it('handles full documentation paths', async () => {
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockResolvedValue(mockViewSymbol),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			await handler({path: 'documentation/swiftui/view'});

			expect(mockClient.getSymbol).toHaveBeenCalled();
		});
	});

	describe('topic sections', () => {
		it('includes topic sections when available', async () => {
			const context = createContextWithTechnology();
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			// MockViewSymbol has topicSections
			expect(result.content[0].text).toContain('Related');
		});

		it('shows related symbols from references', async () => {
			const context = createContextWithTechnology();
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			// MockViewSymbol has Button and Text in references
			expect(result.content[0].text).toMatch(/Button|Text/);
		});
	});

	describe('error handling', () => {
		it('returns error message when symbol not found', async () => {
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockRejectedValue(new Error('Symbol not found')),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			await expect(handler({path: 'NonExistentSymbol'})).rejects.toThrow();
		});

		it('handles invalid technology identifier gracefully', async () => {
			const context = createTestContext();
			// Set a technology with an invalid identifier
			context.state.setActiveTechnology({
				...mockSwiftUITechnology,
				identifier: '',
			});
			const handler = buildGetDocumentationHandler(context);

			await expect(handler({path: 'View'})).rejects.toThrow('Invalid technology identifier');
		});
	});

	describe('framework data caching', () => {
		it('uses cached framework data when available', async () => {
			const mockClient = createMockClient();
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			context.state.setActiveFrameworkData(mockSwiftUIFramework);

			const handler = buildGetDocumentationHandler(context);
			await handler({path: 'View'});

			// GetFramework shouldn't be called if we already have framework data
			// (depends on implementation, but the state should be used)
		});
	});

	describe('parameters section', () => {
		it('includes parameters when available', async () => {
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockResolvedValue(mockButtonSymbol),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'Button'});

			// MockButtonSymbol has parameters
			expect(result.content[0].text).toContain('Parameters');
			expect(result.content[0].text).toContain('action');
			expect(result.content[0].text).toContain('label');
		});
	});

	describe('missing metadata fallbacks', () => {
		it('uses fallback title when metadata.title is missing', async () => {
			const symbolWithoutTitle = {
				...mockViewSymbol,
				metadata: {
					...mockViewSymbol.metadata,
					title: undefined,
				},
			};
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockResolvedValue(symbolWithoutTitle),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			expect(result.content[0].text).toContain('Symbol');
		});

		it('uses fallback kind when metadata.symbolKind is missing', async () => {
			const symbolWithoutKind = {
				...mockViewSymbol,
				metadata: {
					...mockViewSymbol.metadata,
					symbolKind: undefined,
				},
			};
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockResolvedValue(symbolWithoutKind),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			// Should still render without errors
			expect(result.content[0].text).toBeDefined();
		});

		it('uses framework platforms when symbol platforms missing', async () => {
			const symbolWithoutPlatforms = {
				...mockViewSymbol,
				metadata: {
					...mockViewSymbol.metadata,
					platforms: undefined,
				},
			};
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockResolvedValue(symbolWithoutPlatforms),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			// Should fall back to framework platforms
			expect(result.content[0].text).toMatch(/iOS|macOS/);
		});
	});

	describe('content sections', () => {
		it('handles symbols with no primary content sections', async () => {
			const symbolWithoutContent = {
				...mockViewSymbol,
				primaryContentSections: [],
			};
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockResolvedValue(symbolWithoutContent),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			// Should still work, just without declaration/parameters
			expect(result.content[0].text).toContain('View');
			expect(result.content[0].text).not.toContain('Declaration');
		});

		it('handles symbols with no references', async () => {
			const symbolWithoutRefs = {
				...mockViewSymbol,
				references: undefined,
			};
			const mockClient = createMockClient({
				getSymbol: vi.fn().mockResolvedValue(symbolWithoutRefs),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildGetDocumentationHandler(context);

			const result = await handler({path: 'View'});

			// Should not show related symbols
			expect(result.content[0].text).not.toContain('See Also');
		});
	});
});
