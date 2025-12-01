import {describe, it, expect} from 'vitest';
import type {HierarchicalSearchResult} from '../types.js';
import {buildFallbackTitle, buildFallbackLines} from './fallback-formatter.js';

describe('fallback-formatter', () => {
	describe('buildFallbackTitle', () => {
		it('shows hierarchical count when present', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'hierarchical',
				},
				{
					title: 'Text', path: '/text', framework: 'SwiftUI', foundVia: 'hierarchical',
				},
			];

			const title = buildFallbackTitle(results);

			expect(title).toContain('2 hierarchical');
		});

		it('shows fuzzy count alongside hierarchical', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'hierarchical',
				},
				{
					title: 'Text', path: '/text', framework: 'SwiftUI', foundVia: 'regex',
				},
			];

			const title = buildFallbackTitle(results);

			expect(title).toContain('1 hierarchical');
			expect(title).toContain('1 fuzzy');
		});

		it('shows direct count alongside others', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'hierarchical',
				},
				{
					title: 'Text', path: '/text', framework: 'SwiftUI', foundVia: 'direct',
				},
			];

			const title = buildFallbackTitle(results);

			expect(title).toContain('1 hierarchical');
			expect(title).toContain('1 direct');
		});

		it('shows fuzzy only when no hierarchical', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'regex',
				},
				{
					title: 'Text', path: '/text', framework: 'SwiftUI', foundVia: 'regex',
				},
			];

			const title = buildFallbackTitle(results);

			expect(title).toContain('2 fuzzy matches');
			expect(title).not.toContain('hierarchical');
		});

		it('shows direct only when no hierarchical or fuzzy', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'direct',
				},
			];

			const title = buildFallbackTitle(results);

			expect(title).toContain('1 direct matches');
		});
	});

	describe('buildFallbackLines', () => {
		it('includes header with title', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'hierarchical',
				},
			];

			const lines = buildFallbackLines(results);

			expect(lines.some(l => l.includes('Advanced Search Results'))).toBe(true);
		});

		it('formats each result with title', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'hierarchical',
				},
				{
					title: 'Text', path: '/text', framework: 'SwiftUI', foundVia: 'direct',
				},
			];

			const lines = buildFallbackLines(results);

			expect(lines).toContain('### View');
			expect(lines).toContain('### Text');
		});

		it('includes kind when present', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'hierarchical', kind: 'protocol',
				},
			];

			const lines = buildFallbackLines(results);

			expect(lines.some(l => l.includes('**Kind:**') && l.includes('protocol'))).toBe(true);
		});

		it('includes path and foundVia', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/documentation/swiftui/view', framework: 'SwiftUI', foundVia: 'hierarchical',
				},
			];

			const lines = buildFallbackLines(results);

			expect(lines.some(l => l.includes('/documentation/swiftui/view'))).toBe(true);
			expect(lines.some(l => l.includes('hierarchical search'))).toBe(true);
		});

		it('includes platforms when present', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'direct', platforms: 'iOS 13.0+',
				},
			];

			const lines = buildFallbackLines(results);

			expect(lines.some(l => l.includes('**Platforms:**') && l.includes('iOS 13.0+'))).toBe(true);
		});

		it('includes description when present', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'direct', description: 'A type that represents your UI.',
				},
			];

			const lines = buildFallbackLines(results);

			expect(lines.some(l => l.includes('A type that represents your UI.'))).toBe(true);
		});

		it('adds hierarchical explanation when hierarchical results exist', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'hierarchical',
				},
			];

			const lines = buildFallbackLines(results);

			expect(lines.some(l => l.includes('🔍 **Hierarchical results**'))).toBe(true);
		});

		it('adds fuzzy explanation when regex results exist', () => {
			const results: HierarchicalSearchResult[] = [
				{
					title: 'View', path: '/view', framework: 'SwiftUI', foundVia: 'regex',
				},
			];

			const lines = buildFallbackLines(results);

			expect(lines.some(l => l.includes('🎯 **Fuzzy results**'))).toBe(true);
		});

		it('handles empty results array', () => {
			const lines = buildFallbackLines([]);

			expect(lines.some(l => l.includes('Advanced Search Results'))).toBe(true);
			expect(lines.some(l => l.startsWith('### '))).toBe(false);
		});
	});
});
