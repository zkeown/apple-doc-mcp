import {
	describe, it, expect, vi,
} from 'vitest';
import type {RankedReference} from '../types.js';
import type {ServerContext} from '../../../context.js';
import {buildMatchLines} from './match-formatter.js';

const createMockClient = (): ServerContext['client'] => ({
	extractText: vi.fn((abstract: Array<{text: string}>) => abstract?.map(a => a.text).join('') ?? ''),
}) as unknown as ServerContext['client'];

describe('match-formatter', () => {
	describe('buildMatchLines', () => {
		it('formats basic match with title and path', () => {
			const client = createMockClient();
			const matches: RankedReference[] = [
				{
					id: 'doc://View',
					ref: {
						title: 'View',
						url: '/documentation/swiftui/view',
					},
					score: 100,
				},
			];

			const lines = buildMatchLines(matches, client);

			expect(lines).toContain('### View');
			expect(lines.some(l => l.includes('/documentation/swiftui/view'))).toBe(true);
		});

		it('includes kind when present', () => {
			const client = createMockClient();
			const matches: RankedReference[] = [
				{
					id: 'doc://View',
					ref: {
						title: 'View',
						url: '/documentation/swiftui/view',
						kind: 'protocol',
					},
					score: 100,
				},
			];

			const lines = buildMatchLines(matches, client);

			expect(lines.some(l => l.includes('**Kind:**') && l.includes('protocol'))).toBe(true);
		});

		it('extracts and includes abstract text', () => {
			const client = createMockClient();
			const matches: RankedReference[] = [
				{
					id: 'doc://View',
					ref: {
						title: 'View',
						url: '/documentation/swiftui/view',
						abstract: [{text: 'A type that represents your UI.', type: 'text'}],
					},
					score: 100,
				},
			];

			const lines = buildMatchLines(matches, client);

			expect(client.extractText).toHaveBeenCalled();
			expect(lines.some(l => l.includes('A type that represents your UI.'))).toBe(true);
		});

		it('handles empty matches array', () => {
			const client = createMockClient();

			const lines = buildMatchLines([], client);

			expect(lines).toEqual([]);
		});

		it('formats multiple matches', () => {
			const client = createMockClient();
			const matches: RankedReference[] = [
				{
					id: 'doc://View',
					ref: {title: 'View', url: '/view'},
					score: 100,
				},
				{
					id: 'doc://Text',
					ref: {title: 'Text', url: '/text'},
					score: 90,
				},
			];

			const lines = buildMatchLines(matches, client);

			expect(lines.filter(l => l.startsWith('### '))).toHaveLength(2);
		});

		it('omits kind line when kind is missing', () => {
			const client = createMockClient();
			const matches: RankedReference[] = [
				{
					id: 'doc://View',
					ref: {
						title: 'View',
						url: '/view',
						kind: undefined,
					},
					score: 100,
				},
			];

			const lines = buildMatchLines(matches, client);

			expect(lines.some(l => l.includes('**Kind:**'))).toBe(false);
		});

		it('omits abstract line when empty', () => {
			const client = createMockClient();
			vi.mocked(client.extractText).mockReturnValue('');
			const matches: RankedReference[] = [
				{
					id: 'doc://View',
					ref: {
						title: 'View',
						url: '/view',
						abstract: [],
					},
					score: 100,
				},
			];

			const lines = buildMatchLines(matches, client);

			// Should only have title, path, and empty line
			const nonEmptyLines = lines.filter(l => l.trim() !== '');
			expect(nonEmptyLines).toHaveLength(2); // Title and path
		});
	});
});
