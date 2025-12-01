/**
 * Unit tests for ServerState
 *
 * Tests state management functionality without API calls.
 */
import {
	describe, it, expect, beforeEach,
} from 'vitest';
import {
	mockSwiftUITechnology,
	mockUIKitTechnology,
	mockSwiftUIFramework,
} from '../test-utils/fixtures.js';
import {createMockClient} from '../test-utils/mocks.js';
import {ServerState} from './state.js';
import {createLocalSymbolIndex} from './services/symbol-index-factory.js';

describe('ServerState', () => {
	let state: ServerState;

	beforeEach(() => {
		state = new ServerState();
	});

	describe('Active Technology Management', () => {
		it('returns undefined when no technology is set', () => {
			expect(state.getActiveTechnology()).toBeUndefined();
		});

		it('stores and retrieves active technology', () => {
			state.setActiveTechnology(mockSwiftUITechnology);

			const active = state.getActiveTechnology();
			expect(active).toBeDefined();
			expect(active?.title).toBe('SwiftUI');
			expect(active?.identifier).toBe(mockSwiftUITechnology.identifier);
		});

		it('can clear active technology by setting undefined', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			state.setActiveTechnology(undefined);

			expect(state.getActiveTechnology()).toBeUndefined();
		});
	});

	describe('State Reset on Technology Change', () => {
		it('resets framework data when technology changes', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			state.setActiveFrameworkData(mockSwiftUIFramework);

			// Change technology
			state.setActiveTechnology(mockUIKitTechnology);

			expect(state.getActiveFrameworkData()).toBeUndefined();
		});

		it('resets framework index when technology changes', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			state.setFrameworkIndex(new Map([['test', {id: 'test', ref: {title: 'Test', url: '/test'}, tokens: []}]]));

			// Change technology
			state.setActiveTechnology(mockUIKitTechnology);

			expect(state.getFrameworkIndex()).toBeUndefined();
		});

		it('clears expanded identifiers when technology changes', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			state.markIdentifierExpanded('doc://test');
			expect(state.hasExpandedIdentifier('doc://test')).toBe(true);

			// Change technology
			state.setActiveTechnology(mockUIKitTechnology);

			expect(state.hasExpandedIdentifier('doc://test')).toBe(false);
		});

		it('preserves state when same technology is set again', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			state.setActiveFrameworkData(mockSwiftUIFramework);
			state.markIdentifierExpanded('doc://test');

			// Set same technology again
			state.setActiveTechnology(mockSwiftUITechnology);

			// State should be preserved since identifier matches
			expect(state.getActiveFrameworkData()).toBeDefined();
			expect(state.hasExpandedIdentifier('doc://test')).toBe(true);
		});

		it('resets state when setting undefined', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			state.setActiveFrameworkData(mockSwiftUIFramework);
			state.markIdentifierExpanded('doc://test');

			// Clear technology
			state.setActiveTechnology(undefined);

			expect(state.getActiveFrameworkData()).toBeUndefined();
			expect(state.getFrameworkIndex()).toBeUndefined();
			expect(state.hasExpandedIdentifier('doc://test')).toBe(false);
		});
	});

	describe('Framework Data Management', () => {
		it('stores and retrieves framework data', () => {
			state.setActiveFrameworkData(mockSwiftUIFramework);

			const data = state.getActiveFrameworkData();
			expect(data).toBeDefined();
			expect(data?.metadata.title).toBe('SwiftUI');
		});

		it('can clear framework data independently', () => {
			state.setActiveFrameworkData(mockSwiftUIFramework);
			state.clearActiveFrameworkData();

			expect(state.getActiveFrameworkData()).toBeUndefined();
		});
	});

	describe('Framework Index Management', () => {
		it('stores and retrieves framework index', () => {
			const index = new Map([
				['id1', {id: 'id1', ref: {title: 'Symbol1', url: '/s1'}, tokens: ['symbol1']}],
				['id2', {id: 'id2', ref: {title: 'Symbol2', url: '/s2'}, tokens: ['symbol2']}],
			]);
			state.setFrameworkIndex(index);

			const retrieved = state.getFrameworkIndex();
			expect(retrieved).toBeDefined();
			expect(retrieved?.size).toBe(2);
			expect(retrieved?.get('id1')?.ref.title).toBe('Symbol1');
		});

		it('can clear framework index', () => {
			const index = new Map([['id1', {id: 'id1', ref: {title: 'Test', url: '/t'}, tokens: []}]]);
			state.setFrameworkIndex(index);
			state.clearFrameworkIndex();

			expect(state.getFrameworkIndex()).toBeUndefined();
		});

		it('clears expanded identifiers when clearing index', () => {
			state.markIdentifierExpanded('doc://test');
			state.clearFrameworkIndex();

			expect(state.hasExpandedIdentifier('doc://test')).toBe(false);
		});
	});

	describe('Expanded Identifiers Tracking', () => {
		it('tracks expanded identifiers', () => {
			expect(state.hasExpandedIdentifier('doc://test')).toBe(false);

			state.markIdentifierExpanded('doc://test');

			expect(state.hasExpandedIdentifier('doc://test')).toBe(true);
		});

		it('tracks multiple identifiers', () => {
			state.markIdentifierExpanded('doc://test1');
			state.markIdentifierExpanded('doc://test2');
			state.markIdentifierExpanded('doc://test3');

			expect(state.hasExpandedIdentifier('doc://test1')).toBe(true);
			expect(state.hasExpandedIdentifier('doc://test2')).toBe(true);
			expect(state.hasExpandedIdentifier('doc://test3')).toBe(true);
			expect(state.hasExpandedIdentifier('doc://test4')).toBe(false);
		});
	});

	describe('Last Discovery Management', () => {
		it('stores and retrieves last discovery', () => {
			const discovery = {
				query: 'swift',
				results: [mockSwiftUITechnology],
			};
			state.setLastDiscovery(discovery);

			const retrieved = state.getLastDiscovery();
			expect(retrieved).toBeDefined();
			expect(retrieved?.query).toBe('swift');
			expect(retrieved?.results).toHaveLength(1);
		});

		it('returns undefined when no discovery set', () => {
			expect(state.getLastDiscovery()).toBeUndefined();
		});

		it('can clear last discovery', () => {
			state.setLastDiscovery({query: 'test', results: []});
			state.setLastDiscovery(undefined);

			expect(state.getLastDiscovery()).toBeUndefined();
		});
	});

	describe('Local Symbol Index Management', () => {
		it('returns undefined when no index is set', () => {
			expect(state.getLocalSymbolIndex()).toBeUndefined();
		});

		it('stores and retrieves local symbol index', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			const mockClient = createMockClient();
			const index = createLocalSymbolIndex(mockClient, mockSwiftUITechnology);

			state.setLocalSymbolIndex(index);

			expect(state.getLocalSymbolIndex()).toBe(index);
			expect(typeof index.search).toBe('function');
			expect(typeof index.buildIndexFromCache).toBe('function');
		});

		it('returns same index instance on subsequent calls', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			const mockClient = createMockClient();
			const index = createLocalSymbolIndex(mockClient, mockSwiftUITechnology);
			state.setLocalSymbolIndex(index);

			const index1 = state.getLocalSymbolIndex();
			const index2 = state.getLocalSymbolIndex();

			expect(index1).toBe(index2);
		});

		it('clears local symbol index when technology changes', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			const mockClient = createMockClient();
			const index1 = createLocalSymbolIndex(mockClient, mockSwiftUITechnology);
			state.setLocalSymbolIndex(index1);

			// Change technology - should clear the index
			state.setActiveTechnology(mockUIKitTechnology);

			expect(state.getLocalSymbolIndex()).toBeUndefined();
		});

		it('can manually clear local symbol index', () => {
			state.setActiveTechnology(mockSwiftUITechnology);
			const mockClient = createMockClient();
			const index = createLocalSymbolIndex(mockClient, mockSwiftUITechnology);
			state.setLocalSymbolIndex(index);

			state.clearLocalSymbolIndex();

			expect(state.getLocalSymbolIndex()).toBeUndefined();
		});
	});
});
