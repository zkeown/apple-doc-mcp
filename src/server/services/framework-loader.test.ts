import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext} from '../context.js';
import type {FrameworkData, Technology} from '../../apple-client.js';
import {
	loadActiveFrameworkData,
	ensureFrameworkIndex,
	expandSymbolReferences,
	getFrameworkIndexEntries,
} from './framework-loader.js';

const mockTechnology: Technology = {
	abstract: [{text: 'SwiftUI framework', type: 'text'}],
	identifier: 'doc://com.apple.documentation/documentation/swiftui',
	title: 'SwiftUI',
	url: '/documentation/swiftui',
	kind: 'technology',
	role: 'collection',
};

const mockFramework: FrameworkData = {
	abstract: [{text: 'SwiftUI framework', type: 'text'}],
	metadata: {
		title: 'SwiftUI',
		role: 'collection',
		platforms: [{name: 'iOS', introducedAt: '13.0'}],
	},
	references: {
		'doc://View': {
			title: 'View',
			url: '/documentation/swiftui/view',
			kind: 'protocol',
			abstract: [{text: 'A type that represents your UI.', type: 'text'}],
		},
		'doc://Text': {
			title: 'Text',
			url: '/documentation/swiftui/text',
			kind: 'struct',
			abstract: [{text: 'Displays text.', type: 'text'}],
		},
	},
	topicSections: [
		{title: 'Views', identifiers: ['doc://View', 'doc://Text']},
	],
};

const createMockContext = (options: {
	technology?: Technology | undefined;
	frameworkData?: FrameworkData | undefined;
	frameworkIndex?: Map<string, unknown> | undefined;
} = {}): ServerContext => {
	const state = {
		getActiveTechnology: vi.fn(() => options.technology),
		getActiveFrameworkData: vi.fn(() => options.frameworkData),
		setActiveFrameworkData: vi.fn(),
		getFrameworkIndex: vi.fn(() => options.frameworkIndex),
		setFrameworkIndex: vi.fn(),
		clearFrameworkIndex: vi.fn(),
		hasExpandedIdentifier: vi.fn(() => false),
		markIdentifierExpanded: vi.fn(),
	};

	const client = {
		getFramework: vi.fn().mockResolvedValue(mockFramework),
		getSymbol: vi.fn().mockResolvedValue({references: {}}),
		extractText: vi.fn((abstract: Array<{text: string}>) => abstract?.map(a => a.text).join('') ?? ''),
	};

	return {client, state} as unknown as ServerContext;
};

describe('framework-loader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('loadActiveFrameworkData', () => {
		it('throws when no technology is selected', async () => {
			const context = createMockContext({technology: undefined});

			await expect(loadActiveFrameworkData(context)).rejects.toThrow(McpError);
			await expect(loadActiveFrameworkData(context)).rejects.toMatchObject({
				code: ErrorCode.InvalidRequest,
			});
		});

		it('returns cached framework data when available', async () => {
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: mockFramework,
			});

			const result = await loadActiveFrameworkData(context);

			expect(result).toBe(mockFramework);
			expect(context.client.getFramework).not.toHaveBeenCalled();
		});

		it('fetches framework data when not cached', async () => {
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: undefined,
			});

			const result = await loadActiveFrameworkData(context);

			expect(result).toEqual(mockFramework);
			expect(context.client.getFramework).toHaveBeenCalledWith('swiftui');
			expect(context.state.setActiveFrameworkData).toHaveBeenCalledWith(mockFramework);
			expect(context.state.clearFrameworkIndex).toHaveBeenCalled();
		});

		it('throws for invalid technology identifier', async () => {
			const invalidTechnology: Technology = {
				...mockTechnology,
				identifier: '',
			};
			const context = createMockContext({technology: invalidTechnology});

			await expect(loadActiveFrameworkData(context)).rejects.toThrow(McpError);
		});
	});

	describe('ensureFrameworkIndex', () => {
		it('returns existing index when available', async () => {
			const existingIndex = new Map([['doc://View', {id: 'doc://View', ref: {}, tokens: []}]]);
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: mockFramework,
				frameworkIndex: existingIndex,
			});

			const result = await ensureFrameworkIndex(context);

			expect(result).toBe(existingIndex);
		});

		it('builds index from framework references when not cached', async () => {
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: mockFramework,
				frameworkIndex: undefined,
			});

			const result = await ensureFrameworkIndex(context);

			expect(result.size).toBe(2);
			expect(result.has('doc://View')).toBe(true);
			expect(result.has('doc://Text')).toBe(true);
			expect(context.state.setFrameworkIndex).toHaveBeenCalled();
		});

		it('includes tokens in index entries', async () => {
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: mockFramework,
				frameworkIndex: undefined,
			});

			const result = await ensureFrameworkIndex(context);
			const viewEntry = result.get('doc://View');

			expect(viewEntry).toBeDefined();
			expect(viewEntry?.tokens).toBeInstanceOf(Array);
			expect(viewEntry?.tokens.length).toBeGreaterThan(0);
		});
	});

	describe('expandSymbolReferences', () => {
		it('throws when no technology is selected', async () => {
			const context = createMockContext({technology: undefined});

			await expect(expandSymbolReferences(context, ['doc://Test'])).rejects.toThrow(McpError);
		});

		it('skips already expanded identifiers', async () => {
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: mockFramework,
				frameworkIndex: undefined,
			});
			vi.mocked(context.state.hasExpandedIdentifier).mockReturnValue(true);

			await expandSymbolReferences(context, ['doc://View']);

			expect(context.client.getSymbol).not.toHaveBeenCalled();
		});

		it('fetches and processes new identifiers', async () => {
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: mockFramework,
				frameworkIndex: undefined,
			});
			vi.mocked(context.client.getSymbol).mockResolvedValue({
				abstract: [{text: 'New symbol', type: 'text'}],
				metadata: {title: 'NewSymbol', symbolKind: 'struct', platforms: []},
				primaryContentSections: [],
				references: {
					'doc://NewSymbol': {title: 'NewSymbol', url: '/new', kind: 'struct'},
				},
				topicSections: [],
			});

			const result = await expandSymbolReferences(context, ['doc://com.apple.documentation/test']);

			expect(context.client.getSymbol).toHaveBeenCalled();
			expect(context.state.markIdentifierExpanded).toHaveBeenCalled();
			expect(result.size).toBeGreaterThan(0);
		});

		it('handles fetch errors gracefully', async () => {
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: mockFramework,
				frameworkIndex: undefined,
			});
			vi.mocked(context.client.getSymbol).mockRejectedValue(new Error('Network error'));

			// Should not throw, should log warning
			const result = await expandSymbolReferences(context, ['doc://broken']);

			expect(result).toBeInstanceOf(Map);
		});
	});

	describe('getFrameworkIndexEntries', () => {
		it('returns array of index entries', async () => {
			const context = createMockContext({
				technology: mockTechnology,
				frameworkData: mockFramework,
				frameworkIndex: undefined,
			});

			const entries = await getFrameworkIndexEntries(context);

			expect(entries).toBeInstanceOf(Array);
			expect(entries.length).toBe(2);
		});
	});
});
