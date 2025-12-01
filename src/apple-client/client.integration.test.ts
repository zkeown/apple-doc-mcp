/**
 * Integration tests for AppleDevDocsClient
 *
 * These tests verify the client's methods work correctly with Apple's real API.
 * Run with: pnpm test:integration
 */
import {
	describe, it, expect, beforeAll,
} from 'vitest';
import {AppleDevDocsClient} from '../apple-client.js';

describe('AppleDevDocsClient Integration Tests', () => {
	let client: AppleDevDocsClient;

	beforeAll(() => {
		client = new AppleDevDocsClient();
	});

	describe('getTechnologies', () => {
		it('returns a record of technologies', async () => {
			const technologies = await client.getTechnologies();

			expect(technologies).toBeDefined();
			expect(typeof technologies).toBe('object');

			// Should have many technologies
			const techCount = Object.keys(technologies).length;
			expect(techCount).toBeGreaterThan(50);
		});

		it('includes SwiftUI technology', async () => {
			const technologies = await client.getTechnologies();

			// Find SwiftUI
			const swiftui = Object.values(technologies).find(tech => tech.title === 'SwiftUI');
			expect(swiftui).toBeDefined();
			// Identifier contains SwiftUI (case-insensitive)
			expect(swiftui?.identifier?.toLowerCase()).toContain('swiftui');
			expect(swiftui?.kind).toBe('symbol');
			expect(swiftui?.role).toBe('collection');
		});

		it('technologies have required fields', async () => {
			const technologies = await client.getTechnologies();
			const techs = Object.values(technologies).slice(0, 10);

			for (const tech of techs) {
				expect(tech).toHaveProperty('identifier');
				expect(tech).toHaveProperty('title');
				expect(tech).toHaveProperty('url');
				expect(tech).toHaveProperty('kind');
				expect(tech).toHaveProperty('role');
			}
		});
	});

	describe('getFramework', () => {
		it('fetches SwiftUI framework data', async () => {
			const framework = await client.getFramework('SwiftUI');

			expect(framework).toBeDefined();
			expect(framework.metadata.title).toBe('SwiftUI');
			expect(framework.metadata.platforms).toBeDefined();
			expect(framework.references).toBeDefined();
		});

		it('fetches UIKit framework data', async () => {
			const framework = await client.getFramework('UIKit');

			expect(framework).toBeDefined();
			expect(framework.metadata.title).toBe('UIKit');
		});

		it('fetches Foundation framework data', async () => {
			const framework = await client.getFramework('Foundation');

			expect(framework).toBeDefined();
			expect(framework.metadata.title).toBe('Foundation');
		});

		it('framework has abstract', async () => {
			const framework = await client.getFramework('SwiftUI');

			expect(framework.abstract).toBeDefined();
			expect(Array.isArray(framework.abstract)).toBe(true);
			expect(framework.abstract.length).toBeGreaterThan(0);
		});

		it('framework has platform information', async () => {
			const framework = await client.getFramework('SwiftUI');

			expect(framework.metadata.platforms).toBeDefined();
			expect(framework.metadata.platforms.length).toBeGreaterThan(0);

			const platform = framework.metadata.platforms[0];
			expect(platform.name).toBeDefined();
			expect(platform.introducedAt).toBeDefined();
		});

		it('framework has topic sections', async () => {
			const framework = await client.getFramework('SwiftUI');

			expect(framework.topicSections).toBeDefined();
			expect(framework.topicSections.length).toBeGreaterThan(0);

			const section = framework.topicSections[0];
			expect(section.title).toBeDefined();
			expect(section.identifiers).toBeDefined();
		});

		it('framework has symbol references', async () => {
			const framework = await client.getFramework('SwiftUI');

			expect(framework.references).toBeDefined();
			const refCount = Object.keys(framework.references).length;
			expect(refCount).toBeGreaterThan(10);

			// Check reference structure
			const ref = Object.values(framework.references)[0];
			expect(ref.title).toBeDefined();
			expect(ref.url).toBeDefined();
		});
	});

	describe('getSymbol', () => {
		it('fetches SwiftUI View symbol', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/View');

			expect(symbol).toBeDefined();
			expect(symbol.metadata.title).toBe('View');
			expect(symbol.metadata.symbolKind).toBe('protocol');
		});

		it('fetches SwiftUI Button symbol', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/Button');

			expect(symbol).toBeDefined();
			expect(symbol.metadata.title).toBe('Button');
			expect(symbol.metadata.symbolKind).toBeDefined();
		});

		it('symbol has abstract', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/View');

			expect(symbol.abstract).toBeDefined();
			expect(Array.isArray(symbol.abstract)).toBe(true);
		});

		it('symbol has platform information', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/View');

			expect(symbol.metadata.platforms).toBeDefined();
			expect(symbol.metadata.platforms.length).toBeGreaterThan(0);
		});

		it('symbol has primary content sections', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/View');

			expect(symbol.primaryContentSections).toBeDefined();
			expect(symbol.primaryContentSections.length).toBeGreaterThan(0);
		});

		it('symbol has declarations section', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/View');

			const declSection = symbol.primaryContentSections.find(s => s.kind === 'declarations');
			expect(declSection).toBeDefined();

			if (declSection?.kind === 'declarations') {
				expect(declSection.declarations).toBeDefined();
				expect(declSection.declarations.length).toBeGreaterThan(0);
				expect(declSection.declarations[0].tokens).toBeDefined();
			}
		});

		it('function symbol has parameters section', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/View/opacity(_:)');

			const parameterSection = symbol.primaryContentSections.find(s => s.kind === 'parameters');
			expect(parameterSection).toBeDefined();

			if (parameterSection?.kind === 'parameters') {
				expect(parameterSection.parameters).toBeDefined();
				expect(parameterSection.parameters.length).toBeGreaterThan(0);
			}
		});

		it('requires documentation/ prefix in path', async () => {
			// The API requires the documentation/ prefix
			// Without it, getSymbol passes through to API which returns 404
			await expect(client.getSymbol('SwiftUI/View')).rejects.toThrow();
		});

		it('removes leading slash from path', async () => {
			const symbol = await client.getSymbol('/documentation/SwiftUI/View');

			expect(symbol).toBeDefined();
			expect(symbol.metadata.title).toBe('View');
		});
	});

	describe('searchFramework', () => {
		it('searches SwiftUI for a common term', async () => {
			// Search for 'view' which should match many symbols
			const results = await client.searchFramework('SwiftUI', 'view', {maxResults: 10});

			expect(results).toBeDefined();
			// May or may not find results depending on reference structure
			expect(Array.isArray(results)).toBe(true);
		});

		it('respects maxResults parameter', async () => {
			const results = await client.searchFramework('SwiftUI', 'view', {maxResults: 5});

			expect(results.length).toBeLessThanOrEqual(5);
		});

		it('returns results with required fields when matches found', async () => {
			const results = await client.searchFramework('SwiftUI', 'view', {maxResults: 3});

			for (const result of results) {
				expect(result.title).toBeDefined();
				expect(result.framework).toBe('SwiftUI');
				expect(result.path).toBeDefined();
			}
		});

		it('returns empty array for non-matching query', async () => {
			const results = await client.searchFramework('SwiftUI', 'xyznonexistent12345');

			expect(results).toBeDefined();
			expect(results.length).toBe(0);
		});
	});

	describe('extractText helper', () => {
		it('extracts text from abstract array', () => {
			const abstract = [{text: 'Hello', type: 'text'}, {text: ' World', type: 'text'}];
			const text = client.extractText(abstract);

			expect(text).toBe('Hello World');
		});

		it('handles empty array', () => {
			const text = client.extractText([]);

			expect(text).toBe('');
		});

		it('handles undefined', () => {
			const text = client.extractText(undefined as unknown as Array<{text: string; type: string}>);

			expect(text).toBe('');
		});
	});

	describe('formatPlatforms helper', () => {
		it('formats platform information', () => {
			const platforms = [
				{name: 'iOS', introducedAt: '13.0'},
				{name: 'macOS', introducedAt: '10.15'},
			];
			const formatted = client.formatPlatforms(platforms);

			expect(formatted).toContain('iOS 13.0');
			expect(formatted).toContain('macOS 10.15');
		});

		it('returns "All platforms" for empty array', () => {
			const formatted = client.formatPlatforms([]);

			expect(formatted).toBe('All platforms');
		});

		it('returns "All platforms" for undefined', () => {
			const formatted = client.formatPlatforms(undefined as unknown as Array<{name: string; introducedAt: string}>);

			expect(formatted).toBe('All platforms');
		});
	});

	describe('Caching behavior', () => {
		it('caches framework data on subsequent calls', async () => {
			// First call fetches from API
			const framework1 = await client.getFramework('SwiftUI');

			// Second call should use cache (much faster)
			const start = Date.now();
			const framework2 = await client.getFramework('SwiftUI');
			const duration = Date.now() - start;

			expect(framework1.metadata.title).toBe(framework2.metadata.title);
			// Cached call should be very fast (< 100ms vs ~500ms+ for API)
			expect(duration).toBeLessThan(100);
		});

		it('caches symbol data on subsequent calls', async () => {
			// First call
			const symbol1 = await client.getSymbol('documentation/SwiftUI/View');

			// Second call should use cache
			const start = Date.now();
			const symbol2 = await client.getSymbol('documentation/SwiftUI/View');
			const duration = Date.now() - start;

			expect(symbol1.metadata.title).toBe(symbol2.metadata.title);
			expect(duration).toBeLessThan(100);
		});
	});

	describe('Edge cases', () => {
		it('handles Metal Performance Shaders framework', async () => {
			const framework = await client.getFramework('MetalPerformanceShaders');

			expect(framework).toBeDefined();
			expect(framework.metadata.title).toBe('Metal Performance Shaders');
		});

		it('handles symbols with special characters in path', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/View/opacity(_:)');

			expect(symbol).toBeDefined();
			expect(symbol.metadata.title).toContain('opacity');
		});

		it('handles nested symbols', async () => {
			const symbol = await client.getSymbol('documentation/SwiftUI/Text');

			expect(symbol).toBeDefined();
			expect(symbol.topicSections).toBeDefined();
		});
	});
});
