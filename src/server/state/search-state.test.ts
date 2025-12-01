import {
	describe, it, expect, beforeEach, vi,
} from 'vitest';
import type {Technology} from '../../apple-client.js';
import type {LocalSymbolIndex} from '../services/local-symbol-index.js';
import {SearchState, type LastDiscovery} from './search-state.js';

const mockTechnology: Technology = {
	abstract: [{text: 'SwiftUI framework', type: 'text'}],
	identifier: 'doc://com.apple.documentation/documentation/swiftui',
	title: 'SwiftUI',
	url: '/documentation/swiftui',
	kind: 'technology',
	role: 'collection',
};

const mockDiscovery: LastDiscovery = {
	query: 'swift',
	results: [mockTechnology],
};

// Mock LocalSymbolIndex for testing
const createMockIndex = (): LocalSymbolIndex => ({
	buildIndexFromCache: vi.fn(),
	search: vi.fn().mockReturnValue([]),
	getSymbolCount: vi.fn().mockReturnValue(0),
	clear: vi.fn(),
}) as unknown as LocalSymbolIndex;

describe('SearchState', () => {
	let state: SearchState;

	beforeEach(() => {
		state = new SearchState();
	});

	describe('lastDiscovery', () => {
		it('returns undefined initially', () => {
			expect(state.getLastDiscovery()).toBeUndefined();
		});

		it('sets and gets last discovery', () => {
			state.setLastDiscovery(mockDiscovery);
			expect(state.getLastDiscovery()).toBe(mockDiscovery);
		});

		it('can set to undefined', () => {
			state.setLastDiscovery(mockDiscovery);
			state.setLastDiscovery(undefined);
			expect(state.getLastDiscovery()).toBeUndefined();
		});

		it('can store discovery without query', () => {
			const discoveryNoQuery: LastDiscovery = {results: [mockTechnology]};
			state.setLastDiscovery(discoveryNoQuery);
			expect(state.getLastDiscovery()?.query).toBeUndefined();
			expect(state.getLastDiscovery()?.results).toHaveLength(1);
		});

		it('can store empty results', () => {
			const emptyDiscovery: LastDiscovery = {query: 'nothing', results: []};
			state.setLastDiscovery(emptyDiscovery);
			expect(state.getLastDiscovery()?.results).toHaveLength(0);
		});
	});

	describe('localSymbolIndex', () => {
		it('returns undefined initially', () => {
			expect(state.getLocalSymbolIndex()).toBeUndefined();
		});

		it('sets and gets local symbol index', () => {
			const index = createMockIndex();
			state.setLocalSymbolIndex(index);
			expect(state.getLocalSymbolIndex()).toBe(index);
		});

		it('clears local symbol index', () => {
			const index = createMockIndex();
			state.setLocalSymbolIndex(index);
			state.clearLocalSymbolIndex();
			expect(state.getLocalSymbolIndex()).toBeUndefined();
		});

		it('returns same index on multiple gets', () => {
			const index = createMockIndex();
			state.setLocalSymbolIndex(index);
			expect(state.getLocalSymbolIndex()).toBe(state.getLocalSymbolIndex());
		});
	});

	describe('resetForTechnologyChange', () => {
		it('clears local symbol index', () => {
			const index = createMockIndex();
			state.setLocalSymbolIndex(index);
			state.resetForTechnologyChange();
			expect(state.getLocalSymbolIndex()).toBeUndefined();
		});

		it('preserves last discovery', () => {
			state.setLastDiscovery(mockDiscovery);
			state.setLocalSymbolIndex(createMockIndex());
			state.resetForTechnologyChange();
			expect(state.getLastDiscovery()).toBe(mockDiscovery);
		});
	});
});
