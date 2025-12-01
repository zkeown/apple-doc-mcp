/**
 * Comprehensive coverage integration tests for Apple Developer Documentation API
 *
 * These tests provide broad coverage across many frameworks and symbols,
 * using parameterized tests and random sampling for thorough verification.
 *
 * Run with: pnpm test:integration
 */
import {
	describe, it, expect, beforeAll,
} from 'vitest';
import {AppleDevDocsClient} from '../apple-client.js';
import {
	selectRandomSample,
	extractSymbolPaths,
	TEST_SEED,
} from '../test-utils/sampling.js';
import {HttpClient} from './http-client.js';
import {
	FrameworkDataSchema,
	SymbolDataSchema,
} from './types/schemas.js';
import {assertValidSchema} from './types/validators.js';
import type {FrameworkData, ReferenceData} from './types/index.js';

const client = new AppleDevDocsClient();
const httpClient = new HttpClient();

const fetchDoc = async <T>(path: string): Promise<T> =>
	httpClient.getDocumentation<T>(path);

// Framework categories for systematic testing
// Only includes frameworks known to exist in Apple's API
const FRAMEWORK_CATEGORIES = {
	ui: ['SwiftUI', 'UIKit', 'AppKit'],
	foundation: ['Foundation'],
	graphics: ['CoreGraphics', 'Metal', 'MetalPerformanceShaders'],
	media: ['AVFoundation', 'CoreMedia'],
	data: ['CoreData'],
	networking: ['Network'],
};

// Flatten all frameworks for parameterized tests
const ALL_FRAMEWORKS = Object.values(FRAMEWORK_CATEGORIES).flat();

// Symbol kinds to ensure coverage
const SYMBOL_KINDS = ['protocol', 'struct', 'class', 'enum', 'func', 'typealias'];

describe('Framework Coverage Tests', () => {
	describe.each(Object.entries(FRAMEWORK_CATEGORIES))(
		'Category: %s',
		(category, frameworks) => {
			it.each(frameworks)('%s framework loads and validates', async framework => {
				const data = await fetchDoc<unknown>(`documentation/${framework}`);

				// Basic structure validation
				assertValidSchema(FrameworkDataSchema, data, framework);
			});
		},
	);
});

describe('Random Symbol Sampling Tests', () => {
	const SAMPLE_SIZE = 5;
	const FRAMEWORKS_TO_SAMPLE = ['SwiftUI', 'UIKit', 'Foundation', 'CoreData'];

	describe.each(FRAMEWORKS_TO_SAMPLE)('Framework: %s', frameworkName => {
		let symbolPaths: string[];

		beforeAll(async () => {
			const framework = await client.getFramework(frameworkName);
			symbolPaths = extractSymbolPaths(framework.references);
		});

		it(`validates ${SAMPLE_SIZE} random symbols`, async () => {
			const sample = selectRandomSample(symbolPaths, SAMPLE_SIZE, TEST_SEED);
			const failures: string[] = [];

			for (const path of sample) {
				try {
					const symbol = await fetchDoc<unknown>(path);
					assertValidSchema(SymbolDataSchema, symbol, path);
				} catch (error) {
					// Some paths may be articles or other non-symbol content
					const message = error instanceof Error ? error.message : String(error);
					if (!message.includes('404') && !message.includes('Request failed')) {
						failures.push(`${path}: ${message}`);
					}
				}
			}

			if (failures.length > 0) {
				console.error('Symbol validation failures:', failures);
			}

			// Allow some failures for non-symbol paths
			expect(failures.length).toBeLessThan(SAMPLE_SIZE);
		});
	});
});

describe('Symbol Kind Coverage Matrix', () => {
	let swiftUIRefs: Record<string, ReferenceData>;

	beforeAll(async () => {
		const framework = await client.getFramework('SwiftUI');
		swiftUIRefs = framework.references;
	});

	it.each(SYMBOL_KINDS)(
		'can fetch and validate at least one %s symbol',
		async kind => {
			// Find a symbol of this kind
			const symbolRef = Object.values(swiftUIRefs).find(ref => ref.kind === kind && ref.url?.startsWith('/documentation/'));

			if (!symbolRef) {
				console.warn(`No ${kind} symbol found in SwiftUI references`);
				return;
			}

			const path = symbolRef.url.replace(/^\//, '');
			const symbol = await fetchDoc<unknown>(path);

			assertValidSchema(SymbolDataSchema, symbol, `${kind}:${path}`);
		},
	);
});

describe('Framework Structure Consistency', () => {
	it.each(ALL_FRAMEWORKS)('%s has expected structure', async framework => {
		try {
			const data = await fetchDoc<FrameworkData>(`documentation/${framework}`);

			// Verify required fields
			expect(data.metadata).toBeDefined();
			expect(data.metadata.title).toBeDefined();

			// These fields may be optional for some frameworks
			if (data.metadata.platforms) {
				expect(data.metadata.platforms).toBeInstanceOf(Array);
			}

			if (data.abstract) {
				expect(data.abstract).toBeInstanceOf(Array);
			}

			if (data.topicSections) {
				expect(data.topicSections).toBeInstanceOf(Array);
			}

			if (data.references) {
				expect(Object.keys(data.references).length).toBeGreaterThan(0);
			}
		} catch (error) {
			// Some frameworks may not exist or be renamed
			const message = error instanceof Error ? error.message : String(error);
			if (message.includes('404')) {
				console.warn(`Framework ${framework} returned 404 - may be renamed`);
			} else {
				throw error;
			}
		}
	});
});

describe('Platform Availability Coverage', () => {
	const PLATFORMS_TO_VERIFY = ['iOS', 'macOS', 'watchOS', 'tvOS', 'visionOS'];

	it('SwiftUI supports expected platforms', async () => {
		const framework = await client.getFramework('SwiftUI');
		const platformNames = framework.metadata.platforms.map(p => p.name);

		for (const platform of PLATFORMS_TO_VERIFY) {
			if (!platformNames.includes(platform)) {
				console.warn(`SwiftUI missing platform: ${platform}`);
			}
		}

		// At least iOS and macOS should be present
		expect(platformNames).toContain('iOS');
		expect(platformNames).toContain('macOS');
	});
});

describe('Edge Case Coverage', () => {
	it('handles framework with spaces in display name', async () => {
		const data = await fetchDoc<FrameworkData>('documentation/MetalPerformanceShaders');
		expect(data.metadata.title).toBe('Metal Performance Shaders');
	});

	it('handles nested function symbols with parameters', async () => {
		const functions = [
			'documentation/SwiftUI/View/opacity(_:)',
			'documentation/SwiftUI/View/onAppear(perform:)',
			'documentation/SwiftUI/View/frame(width:height:alignment:)',
		];

		for (const func of functions) {
			const data = await fetchDoc<unknown>(func);
			assertValidSchema(SymbolDataSchema, data, func);
		}
	});

	it('handles generic type symbols', async () => {
		// Optional is a generic enum
		const data = await fetchDoc<unknown>('documentation/Swift/Optional');
		assertValidSchema(SymbolDataSchema, data, 'Optional');
	});
});

describe('API Smoke Tests', () => {
	it('technologies endpoint returns expected count', async () => {
		const techs = await client.getTechnologies();
		const count = Object.keys(techs).length;

		// Apple typically has 100+ frameworks
		expect(count).toBeGreaterThan(50);
		console.log(`Technologies count: ${count}`);
	});

	it('can fetch documentation for randomly selected frameworks', async () => {
		const techs = await client.getTechnologies();

		// Filter to framework-type technologies
		const frameworks = Object.values(techs).filter(t => t.kind === 'symbol' && t.role === 'collection');

		// Sample 5 random frameworks
		const sample = selectRandomSample(frameworks, 5, TEST_SEED);
		const failures: string[] = [];

		for (const tech of sample) {
			try {
				// Extract framework name from identifier
				const match = /\/documentation\/(\w+)/.exec(tech.identifier);
				if (match) {
					await client.getFramework(match[1]);
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				failures.push(`${tech.title}: ${message}`);
			}
		}

		if (failures.length > 0) {
			console.warn('Some frameworks failed to load:', failures);
		}

		// Allow up to 1 failure (some may be deprecated/renamed)
		expect(failures.length).toBeLessThanOrEqual(1);
	});
});
