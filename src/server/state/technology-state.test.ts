import {
	describe, it, expect, beforeEach,
} from 'vitest';
import type {Technology} from '../../apple-client.js';
import {TechnologyState} from './technology-state.js';

const mockSwiftUI: Technology = {
	abstract: [{text: 'SwiftUI framework', type: 'text'}],
	identifier: 'doc://com.apple.documentation/documentation/swiftui',
	title: 'SwiftUI',
	url: '/documentation/swiftui',
	kind: 'technology',
	role: 'collection',
};

const mockUIKit: Technology = {
	abstract: [{text: 'UIKit framework', type: 'text'}],
	identifier: 'doc://com.apple.documentation/documentation/uikit',
	title: 'UIKit',
	url: '/documentation/uikit',
	kind: 'technology',
	role: 'collection',
};

describe('TechnologyState', () => {
	let state: TechnologyState;

	beforeEach(() => {
		state = new TechnologyState();
	});

	describe('getActiveTechnology', () => {
		it('returns undefined initially', () => {
			expect(state.getActiveTechnology()).toBeUndefined();
		});

		it('returns the set technology', () => {
			state.setActiveTechnology(mockSwiftUI);
			expect(state.getActiveTechnology()).toBe(mockSwiftUI);
		});
	});

	describe('setActiveTechnology', () => {
		it('sets a technology', () => {
			state.setActiveTechnology(mockSwiftUI);
			expect(state.getActiveTechnology()).toBe(mockSwiftUI);
		});

		it('can set technology to undefined', () => {
			state.setActiveTechnology(mockSwiftUI);
			state.setActiveTechnology(undefined);
			expect(state.getActiveTechnology()).toBeUndefined();
		});

		it('can change technology', () => {
			state.setActiveTechnology(mockSwiftUI);
			state.setActiveTechnology(mockUIKit);
			expect(state.getActiveTechnology()).toBe(mockUIKit);
		});
	});

	describe('hasChanged', () => {
		it('returns true when previous is undefined and current is set', () => {
			state.setActiveTechnology(mockSwiftUI);
			expect(state.hasChanged(undefined)).toBe(true);
		});

		it('returns true when previous is set and current is undefined', () => {
			state.setActiveTechnology(undefined);
			expect(state.hasChanged(mockSwiftUI.identifier)).toBe(true);
		});

		it('returns true when identifiers differ', () => {
			state.setActiveTechnology(mockUIKit);
			expect(state.hasChanged(mockSwiftUI.identifier)).toBe(true);
		});

		it('returns false when identifiers match', () => {
			state.setActiveTechnology(mockSwiftUI);
			expect(state.hasChanged(mockSwiftUI.identifier)).toBe(false);
		});

		it('returns false when both are undefined', () => {
			state.setActiveTechnology(undefined);
			expect(state.hasChanged(undefined)).toBe(false);
		});
	});
});
