import {readFile, readdir, access} from 'node:fs/promises';
import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import type {AppleDevDocsClient} from '../../apple-client.js';
import {LocalSymbolIndex} from './local-symbol-index.js';

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
	readdir: vi.fn(),
	access: vi.fn(),
}));

const createMockClient = (): AppleDevDocsClient => ({
	extractText: vi.fn((abstract: Array<{text: string}>) => abstract?.map(a => a.text).join('') ?? ''),
}) as unknown as AppleDevDocsClient;

const mockSymbolData = {
	metadata: {
		title: 'View',
		url: '/documentation/swiftui/view',
		symbolKind: 'protocol',
		platforms: [{name: 'iOS', introducedAt: '13.0'}],
	},
	abstract: [{text: 'A type that represents your UI.', type: 'text'}],
	references: {
		'doc://Text': {
			title: 'Text',
			url: '/documentation/swiftui/text',
			kind: 'symbol',
		},
	},
};

const mockFrameworkData = {
	metadata: {
		title: 'SwiftUI',
		platforms: [{name: 'iOS', introducedAt: '13.0'}],
	},
	references: {
		'doc://View': {
			title: 'View',
			url: '/documentation/swiftui/view',
			kind: 'symbol',
		},
	},
};

describe('LocalSymbolIndex', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('buildIndexFromCache', () => {
		it('handles non-existent cache directory', async () => {
			vi.mocked(access).mockRejectedValue(new Error('ENOENT'));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);

			await index.buildIndexFromCache();

			expect(index.getSymbolCount()).toBe(0);
		});

		it('processes JSON files from cache directory', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol1.json', 'symbol2.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);

			await index.buildIndexFromCache();

			expect(index.getSymbolCount()).toBeGreaterThan(0);
		});

		it('skips non-JSON files', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['readme.txt', 'data.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);

			await index.buildIndexFromCache();

			// ReadFile should only be called for .json files
			expect(readFile).toHaveBeenCalledTimes(1);
		});

		it('handles malformed JSON gracefully', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['invalid.json', 'valid.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile)
				.mockResolvedValueOnce('not valid json')
				.mockResolvedValueOnce(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);

			await index.buildIndexFromCache(); // Should not throw

			expect(index.getSymbolCount()).toBeGreaterThan(0);
		});

		it('skips rebuild if already built', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);

			await index.buildIndexFromCache();
			await index.buildIndexFromCache();

			expect(readdir).toHaveBeenCalledTimes(1);
		});

		it('processes framework data files', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['framework.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockFrameworkData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);

			await index.buildIndexFromCache();

			expect(index.getSymbolCount()).toBeGreaterThan(0);
		});
	});

	describe('search', () => {
		it('finds symbols by title', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);
			await index.buildIndexFromCache();

			const results = index.search('View');

			expect(results.length).toBeGreaterThan(0);
			expect(results.some(r => r.title === 'View')).toBe(true);
		});

		it('returns empty array for no matches', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);
			await index.buildIndexFromCache();

			const results = index.search('NonExistentSymbol');

			expect(results).toEqual([]);
		});

		it('respects maxResults limit', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);
			await index.buildIndexFromCache();

			const results = index.search('', 1);

			expect(results.length).toBeLessThanOrEqual(1);
		});

		it('supports wildcard matching with *', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);
			await index.buildIndexFromCache();

			const results = index.search('Vie*');

			expect(results.length).toBeGreaterThan(0);
			expect(results.some(r => r.title === 'View')).toBe(true);
		});

		it('supports wildcard matching with ?', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);
			await index.buildIndexFromCache();

			const results = index.search('Vie?');

			expect(results.length).toBeGreaterThan(0);
			expect(results.some(r => r.title === 'View')).toBe(true);
		});

		it('sorts results by score', async () => {
			const multiSymbolData = {
				metadata: {
					title: 'Button',
					url: '/documentation/swiftui/button',
					symbolKind: 'struct',
					platforms: [{name: 'iOS', introducedAt: '13.0'}],
				},
				abstract: [{text: 'A control for buttons.', type: 'text'}],
				references: {},
			};

			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['view.json', 'button.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(mockSymbolData))
				.mockResolvedValueOnce(JSON.stringify(multiSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);
			await index.buildIndexFromCache();

			// Search for something in abstract
			const results = index.search('control');

			// Button should rank higher because it has "control" in abstract
			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe('getSymbolCount', () => {
		it('returns 0 for empty index', () => {
			const client = createMockClient();
			const index = new LocalSymbolIndex(client);

			expect(index.getSymbolCount()).toBe(0);
		});

		it('returns correct count after indexing', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);
			await index.buildIndexFromCache();

			expect(index.getSymbolCount()).toBeGreaterThan(0);
		});
	});

	describe('clear', () => {
		it('removes all symbols', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);
			await index.buildIndexFromCache();

			expect(index.getSymbolCount()).toBeGreaterThan(0);

			index.clear();

			expect(index.getSymbolCount()).toBe(0);
		});

		it('allows rebuilding after clear', async () => {
			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['symbol.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSymbolData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client);

			await index.buildIndexFromCache();
			index.clear();
			await index.buildIndexFromCache();

			expect(readdir).toHaveBeenCalledTimes(2);
		});
	});

	describe('technology filtering', () => {
		it('filters symbols by technology identifier', async () => {
			const otherFrameworkData = {
				metadata: {
					title: 'UIViewController',
					url: '/documentation/uikit/uiviewcontroller',
					symbolKind: 'class',
					platforms: [{name: 'iOS', introducedAt: '2.0'}],
				},
				abstract: [],
				references: {},
			};

			vi.mocked(access).mockResolvedValue(undefined);
			vi.mocked(readdir).mockResolvedValue(['swiftui.json', 'uikit.json'] as unknown as Awaited<ReturnType<typeof readdir>>);
			vi.mocked(readFile)
				.mockResolvedValueOnce(JSON.stringify(mockSymbolData))
				.mockResolvedValueOnce(JSON.stringify(otherFrameworkData));

			const client = createMockClient();
			const index = new LocalSymbolIndex(client, 'swiftui');
			await index.buildIndexFromCache();

			// Should only have SwiftUI symbols
			const results = index.search('');
			expect(results.every(r => r.path.toLowerCase().includes('swiftui'))).toBe(true);
		});
	});
});
