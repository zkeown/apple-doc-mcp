import {describe, it, expect} from 'vitest';
import type {FrameworkIndexEntry} from '../../state.js';
import type {ReferenceData} from '../../../apple-client.js';
import {scoreEntry, collectMatches} from './scoring.js';

// Helper to create a minimal ReferenceData
const createRef = (overrides: Partial<ReferenceData> = {}): ReferenceData => ({
	title: 'Test',
	url: '/test',
	...overrides,
});

// Helper to create a FrameworkIndexEntry
const createEntry = (
	id: string,
	tokens: string[],
	refOverrides: Partial<ReferenceData> = {},
): FrameworkIndexEntry => ({
	id,
	tokens,
	ref: createRef(refOverrides),
});

describe('scoreEntry', () => {
	describe('exact matches', () => {
		it('should score 5 for exact case-sensitive match', () => {
			const entry = {tokens: ['View', 'body'], ref: createRef()};
			const score = scoreEntry(entry, ['View']);
			expect(score).toBe(5);
		});

		it('should score 5 for each exact match', () => {
			const entry = {tokens: ['View', 'body', 'content'], ref: createRef()};
			const score = scoreEntry(entry, ['View', 'body']);
			expect(score).toBe(10); // 5 + 5
		});
	});

	describe('case-insensitive exact matches', () => {
		it('should score 4 for case-insensitive exact match', () => {
			const entry = {tokens: ['View'], ref: createRef()};
			const score = scoreEntry(entry, ['view']);
			expect(score).toBe(4);
		});

		it('should score 4 for uppercase search on lowercase token', () => {
			const entry = {tokens: ['button'], ref: createRef()};
			const score = scoreEntry(entry, ['BUTTON']);
			expect(score).toBe(4);
		});
	});

	describe('partial matches', () => {
		it('should score 2 for substring match', () => {
			const entry = {tokens: ['GridItem'], ref: createRef()};
			const score = scoreEntry(entry, ['grid']);
			expect(score).toBe(2);
		});

		it('should score 2 for substring at end of token', () => {
			const entry = {tokens: ['GridItem'], ref: createRef()};
			const score = scoreEntry(entry, ['item']);
			expect(score).toBe(2);
		});
	});

	describe('fuzzy matches', () => {
		it('should score 1 for fuzzy match with >70% common chars', () => {
			const entry = {tokens: ['navigation'], ref: createRef()};
			// 'navigaton' (misspelled) - most chars present
			const score = scoreEntry(entry, ['navigaton']);
			expect(score).toBe(1);
		});

		it('should not apply fuzzy match for short terms (<=2 chars)', () => {
			// Note: Short terms can still match via substring (partial match)
			// This test verifies fuzzy matching specifically doesn't apply
			const entry = {tokens: ['xyzabc'], ref: createRef()};
			// 'xy' has 100% chars in common with 'xyzabc' but is too short for fuzzy
			const score = scoreEntry(entry, ['xy']);
			expect(score).toBe(2); // Still gets partial match, not fuzzy
		});
	});

	describe('no matches', () => {
		it('should return 0 for completely unrelated terms', () => {
			const entry = {tokens: ['View', 'body'], ref: createRef()};
			const score = scoreEntry(entry, ['completely', 'unrelated']);
			expect(score).toBe(0);
		});
	});

	describe('multiple terms', () => {
		it('should accumulate scores across multiple terms', () => {
			const entry = {tokens: ['GridItem', 'row'], ref: createRef()};
			// 'Grid' = partial match (2), 'row' = exact match (5)
			const score = scoreEntry(entry, ['Grid', 'row']);
			expect(score).toBe(7);
		});
	});
});

describe('collectMatches', () => {
	const entries: FrameworkIndexEntry[] = [
		createEntry('1', ['Button', 'press'], {title: 'Button', kind: 'struct'}),
		createEntry('2', ['TextField', 'input'], {title: 'TextField', kind: 'struct'}),
		createEntry('3', ['Text', 'display'], {title: 'Text', kind: 'struct'}),
		createEntry('4', ['NavigationView', 'nav'], {title: 'NavigationView', kind: 'protocol'}),
		createEntry('5', ['ButtonStyle', 'style'], {
			title: 'ButtonStyle',
			kind: 'protocol',
			platforms: [{name: 'iOS', introducedAt: '14.0'}],
		}),
	];

	describe('basic matching', () => {
		it('should return matches sorted by score', () => {
			const results = collectMatches(entries, 'Button', 10, {});
			expect(results.length).toBe(2);
			expect(results[0].ref.title).toBe('Button'); // Exact match
			expect(results[1].ref.title).toBe('ButtonStyle'); // Partial match
		});

		it('should respect maxResults limit', () => {
			const results = collectMatches(entries, 'Text', 1, {});
			expect(results.length).toBe(1);
		});

		it('should return empty array for no matches', () => {
			const results = collectMatches(entries, 'xyz123', 10, {});
			expect(results.length).toBe(0);
		});
	});

	describe('symbolType filter', () => {
		it('should filter by symbol type', () => {
			const results = collectMatches(entries, 'Button', 10, {symbolType: 'struct'});
			expect(results.length).toBe(1);
			expect(results[0].ref.title).toBe('Button');
		});

		it('should be case-insensitive for symbol type', () => {
			const results = collectMatches(entries, 'Button', 10, {symbolType: 'STRUCT'});
			expect(results.length).toBe(1);
		});

		it('should filter out non-matching kinds', () => {
			const results = collectMatches(entries, 'Style', 10, {symbolType: 'struct'});
			expect(results.length).toBe(0); // ButtonStyle is a protocol
		});
	});

	describe('platform filter', () => {
		it('should filter by platform', () => {
			const results = collectMatches(entries, 'Style', 10, {platform: 'iOS'});
			expect(results.length).toBe(1);
			expect(results[0].ref.title).toBe('ButtonStyle');
		});

		it('should be case-insensitive for platform', () => {
			const results = collectMatches(entries, 'Style', 10, {platform: 'ios'});
			expect(results.length).toBe(1);
		});

		it('should filter out entries without matching platform', () => {
			const results = collectMatches(entries, 'Button', 10, {platform: 'macOS'});
			expect(results.length).toBe(0); // No entries have macOS platform
		});
	});

	describe('combined filters', () => {
		it('should apply both symbolType and platform filters', () => {
			const entriesWithPlatforms: FrameworkIndexEntry[] = [
				createEntry('1', ['Button'], {title: 'Button', kind: 'struct', platforms: [{name: 'iOS', introducedAt: '14.0'}]}),
				createEntry('2', ['ButtonStyle'], {title: 'ButtonStyle', kind: 'protocol', platforms: [{name: 'iOS', introducedAt: '14.0'}]}),
			];

			const results = collectMatches(entriesWithPlatforms, 'Button', 10, {
				symbolType: 'struct',
				platform: 'iOS',
			});
			expect(results.length).toBe(1);
			expect(results[0].ref.title).toBe('Button');
		});
	});

	describe('sorting', () => {
		it('should sort by score descending', () => {
			const results = collectMatches(entries, 'nav view', 10, {});
			// NavigationView should score highest (contains both 'nav' and 'view')
			expect(results[0].ref.title).toBe('NavigationView');
		});

		it('should sort alphabetically by title when scores are equal', () => {
			const equalScoreEntries: FrameworkIndexEntry[] = [
				createEntry('1', ['ZView'], {title: 'ZView'}),
				createEntry('2', ['AView'], {title: 'AView'}),
				createEntry('3', ['MView'], {title: 'MView'}),
			];

			const results = collectMatches(equalScoreEntries, 'View', 10, {});
			expect(results[0].ref.title).toBe('AView');
			expect(results[1].ref.title).toBe('MView');
			expect(results[2].ref.title).toBe('ZView');
		});
	});

	describe('query parsing', () => {
		it('should split query into terms', () => {
			const results = collectMatches(entries, 'button style', 10, {});
			// Should match ButtonStyle (contains both terms)
			expect(results.some(r => r.ref.title === 'ButtonStyle')).toBe(true);
		});

		it('should handle multiple spaces', () => {
			const results = collectMatches(entries, 'button   style', 10, {});
			expect(results.some(r => r.ref.title === 'ButtonStyle')).toBe(true);
		});

		it('should handle leading/trailing spaces', () => {
			const results = collectMatches(entries, '  button  ', 10, {});
			expect(results.some(r => r.ref.title === 'Button')).toBe(true);
		});
	});
});
