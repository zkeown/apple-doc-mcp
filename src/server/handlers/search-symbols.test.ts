import {
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import {mockSwiftUITechnology} from '../../test-utils/fixtures.js';
import {
	createContextWithTechnology,
	createMockClient,
	createTestContext,
} from '../../test-utils/mocks.js';
import {buildSearchSymbolsHandler} from './search-symbols.js';

describe('search-symbols handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('no technology selected', () => {
		it('returns prompt to select technology when none is active', async () => {
			const context = createTestContext();
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			expect(result.content[0].text).toContain('No Technology Selected');
			expect(result.content[0].text).toContain('discover_technologies');
			expect(result.content[0].text).toContain('choose_technology');
		});
	});

	describe('basic search', () => {
		it('searches with provided query', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'View',
						path: '/documentation/swiftui/view',
						symbolKind: 'protocol',
						description: 'A type that represents part of your app\'s user interface.',
						platforms: 'iOS, macOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			expect(result.content[0].text).toContain('Search Results');
			expect(result.content[0].text).toContain('View');
		});

		it('includes technology name in results', async () => {
			const context = createContextWithTechnology();
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			expect(result.content[0].text).toContain('SwiftUI');
		});

		it('shows match count', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'View',
						path: '/view',
						symbolKind: 'protocol',
						platforms: 'iOS',
					},
					{
						title: 'ViewBuilder',
						path: '/viewbuilder',
						symbolKind: 'struct',
						platforms: 'iOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			expect(result.content[0].text).toContain('Matches');
		});
	});

	describe('search parameters', () => {
		it('respects maxResults parameter', async () => {
			const symbols = Array.from({length: 50}, (_, i) => ({
				title: `Symbol${i}`,
				path: `/symbol${i}`,
				symbolKind: 'struct',
				platforms: 'iOS',
			}));
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue(symbols),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'Symbol', maxResults: 5});

			// Count symbols in output (look for ### headers)
			const symbolHeaders = result.content[0].text.match(/### /g) ?? [];
			expect(symbolHeaders.length).toBeLessThanOrEqual(5);
		});

		it('filters by platform when specified', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'iOSView',
						path: '/ios',
						symbolKind: 'struct',
						platforms: 'iOS',
					},
					{
						title: 'MacView',
						path: '/mac',
						symbolKind: 'struct',
						platforms: 'macOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View', platform: 'iOS'});

			expect(result.content[0].text).toContain('iOSView');
			expect(result.content[0].text).not.toContain('MacView');
		});

		it('filters by symbolType when specified', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'MyProtocol',
						path: '/protocol',
						symbolKind: 'protocol',
						platforms: 'iOS',
					},
					{
						title: 'MyStruct',
						path: '/struct',
						symbolKind: 'struct',
						platforms: 'iOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'My', symbolType: 'protocol'});

			expect(result.content[0].text).toContain('MyProtocol');
			expect(result.content[0].text).not.toContain('MyStruct');
		});
	});

	describe('no results', () => {
		it('shows helpful message when no results found', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'NonExistentSymbol'});

			expect(result.content[0].text).toContain('No symbols matched');
			expect(result.content[0].text).toContain('Search Tips');
		});

		it('suggests get_documentation for specific symbol names', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			// View is a specific symbol name (starts with capital)
			expect(result.content[0].text).toContain('get_documentation');
		});

		it('mentions wildcard support in tips', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'test'});

			expect(result.content[0].text).toContain('wildcard');
		});
	});

	describe('result formatting', () => {
		it('formats symbol kind nicely', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'View',
						path: '/view',
						symbolKind: 'protocol',
						platforms: 'iOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			expect(result.content[0].text).toContain('Protocol');
		});

		it('includes symbol path for documentation lookup', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'View',
						path: '/documentation/swiftui/view',
						symbolKind: 'protocol',
						platforms: 'iOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			expect(result.content[0].text).toContain('/documentation/swiftui/view');
		});

		it('includes platform information', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'View',
						path: '/view',
						symbolKind: 'protocol',
						platforms: 'iOS, macOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			expect(result.content[0].text).toMatch(/iOS|macOS/);
		});

		it('truncates long abstracts', async () => {
			const longAbstract = 'A'.repeat(300);
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'View',
						path: '/view',
						symbolKind: 'protocol',
						description: longAbstract,
						platforms: 'iOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			// Should be truncated with ellipsis
			expect(result.content[0].text).toContain('...');
			expect(result.content[0].text.length).toBeLessThan(longAbstract.length + 500);
		});
	});

	describe('index status', () => {
		it('shows status when using fallback search', async () => {
			const mockClient = createMockClient({
				searchFramework: vi.fn().mockResolvedValue([
					{
						title: 'View',
						path: '/view',
						symbolKind: 'protocol',
						platforms: 'iOS',
					},
				]),
			});
			const context = createTestContext({client: mockClient});
			context.state.setActiveTechnology(mockSwiftUITechnology);
			const handler = buildSearchSymbolsHandler(context);

			const result = await handler({query: 'View'});

			// Should show some status about the index
			expect(result.content[0].text).toMatch(/index|symbols indexed/i);
		});
	});
});
