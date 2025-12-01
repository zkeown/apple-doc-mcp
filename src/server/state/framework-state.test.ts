import {
	describe, it, expect, beforeEach,
} from 'vitest';
import type {FrameworkData} from '../../apple-client.js';
import {FrameworkState, type FrameworkIndexEntry} from './framework-state.js';

const mockFrameworkData: FrameworkData = {
	abstract: [{text: 'SwiftUI framework', type: 'text'}],
	metadata: {
		title: 'SwiftUI',
		role: 'collection',
		platforms: [{name: 'iOS', introducedAt: '13.0'}],
	},
	references: {},
	topicSections: [],
};

const createMockIndexEntry = (id: string): FrameworkIndexEntry => ({
	id,
	ref: {title: id, url: `/test/${id}`},
	tokens: [id.toLowerCase()],
});

describe('FrameworkState', () => {
	let state: FrameworkState;

	beforeEach(() => {
		state = new FrameworkState();
	});

	describe('activeFrameworkData', () => {
		it('returns undefined initially', () => {
			expect(state.getActiveFrameworkData()).toBeUndefined();
		});

		it('sets and gets framework data', () => {
			state.setActiveFrameworkData(mockFrameworkData);
			expect(state.getActiveFrameworkData()).toBe(mockFrameworkData);
		});

		it('clears framework data', () => {
			state.setActiveFrameworkData(mockFrameworkData);
			state.clearActiveFrameworkData();
			expect(state.getActiveFrameworkData()).toBeUndefined();
		});

		it('can set to undefined', () => {
			state.setActiveFrameworkData(mockFrameworkData);
			state.setActiveFrameworkData(undefined);
			expect(state.getActiveFrameworkData()).toBeUndefined();
		});
	});

	describe('frameworkIndex', () => {
		it('returns undefined initially', () => {
			expect(state.getFrameworkIndex()).toBeUndefined();
		});

		it('sets and gets framework index', () => {
			const index = new Map<string, FrameworkIndexEntry>();
			index.set('view', createMockIndexEntry('View'));
			state.setFrameworkIndex(index);
			expect(state.getFrameworkIndex()).toBe(index);
		});

		it('clears framework index', () => {
			const index = new Map<string, FrameworkIndexEntry>();
			state.setFrameworkIndex(index);
			state.clearFrameworkIndex();
			expect(state.getFrameworkIndex()).toBeUndefined();
		});

		it('clears expanded identifiers when clearing index', () => {
			state.markIdentifierExpanded('doc://test');
			expect(state.hasExpandedIdentifier('doc://test')).toBe(true);
			state.clearFrameworkIndex();
			expect(state.hasExpandedIdentifier('doc://test')).toBe(false);
		});
	});

	describe('expandedIdentifiers', () => {
		it('returns false for unknown identifier', () => {
			expect(state.hasExpandedIdentifier('doc://unknown')).toBe(false);
		});

		it('marks identifier as expanded', () => {
			state.markIdentifierExpanded('doc://test');
			expect(state.hasExpandedIdentifier('doc://test')).toBe(true);
		});

		it('can mark multiple identifiers', () => {
			state.markIdentifierExpanded('doc://test1');
			state.markIdentifierExpanded('doc://test2');
			state.markIdentifierExpanded('doc://test3');
			expect(state.hasExpandedIdentifier('doc://test1')).toBe(true);
			expect(state.hasExpandedIdentifier('doc://test2')).toBe(true);
			expect(state.hasExpandedIdentifier('doc://test3')).toBe(true);
			expect(state.hasExpandedIdentifier('doc://test4')).toBe(false);
		});

		it('marking same identifier twice is idempotent', () => {
			state.markIdentifierExpanded('doc://test');
			state.markIdentifierExpanded('doc://test');
			expect(state.hasExpandedIdentifier('doc://test')).toBe(true);
		});
	});

	describe('reset', () => {
		it('clears all state', () => {
			state.setActiveFrameworkData(mockFrameworkData);
			state.setFrameworkIndex(new Map());
			state.markIdentifierExpanded('doc://test');

			state.reset();

			expect(state.getActiveFrameworkData()).toBeUndefined();
			expect(state.getFrameworkIndex()).toBeUndefined();
			expect(state.hasExpandedIdentifier('doc://test')).toBe(false);
		});
	});
});
