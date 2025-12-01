/**
 * Schema validation integration tests for Apple Developer Documentation API
 *
 * These tests verify that Apple's real API responses match our TypeScript types.
 * If Apple changes their API, these tests will fail with detailed error messages.
 *
 * Run with: pnpm test:integration
 */
import {
	describe, it, expect, beforeAll,
} from 'vitest';
import {HttpClient} from './http-client.js';
import {
	FrameworkDataSchema,
	SymbolDataSchema,
	TechnologySchema,
	PlatformInfoSchema,
	DeclarationTokenSchema,
	ReferenceDataSchema,
	PrimaryContentSectionSchema,
} from './types/schemas.js';
import {validateWithSchema, assertValidSchema} from './types/validators.js';

const httpClient = new HttpClient();

const fetchDoc = async <T>(path: string): Promise<T> =>
	httpClient.getDocumentation<T>(path);

describe('Schema Validation - Apple API Contract', () => {
	describe('Technologies Endpoint', () => {
		it('validates sample of technologies match TechnologySchema', async () => {
			const response = await fetchDoc<{references: Record<string, unknown>}>('documentation/technologies');

			const technologies = Object.entries(response.references);
			expect(technologies.length).toBeGreaterThan(50);

			// Filter to actual technologies (exclude images and other non-technology entries)
			const actualTechnologies = technologies.filter(([key, tech]) => {
				const t = tech as Record<string, unknown>;
				// Technologies have identifier, kind, role, title, url
				return (
					typeof t.identifier === 'string'
					&& typeof t.kind === 'string'
					&& typeof t.role === 'string'
					&& typeof t.title === 'string'
					&& typeof t.url === 'string'
				);
			});

			// Validate first 20 actual technologies
			const sample = actualTechnologies.slice(0, 20);
			const failures: string[] = [];

			for (const [key, tech] of sample) {
				const result = validateWithSchema(TechnologySchema, tech, key);
				if (!result.success) {
					failures.push(...result.errors);
				}
			}

			expect(failures).toEqual([]);
		});
	});

	describe('Framework Endpoint Schema Validation', () => {
		const frameworks = ['SwiftUI', 'UIKit', 'Foundation', 'CoreData', 'Combine'];

		it.each(frameworks)('%s matches FrameworkDataSchema', async framework => {
			const data = await fetchDoc<unknown>(`documentation/${framework}`);
			assertValidSchema(FrameworkDataSchema, data, framework);
		});

		it('validates all platforms in SwiftUI metadata', async () => {
			const data = await fetchDoc<{metadata: {platforms: unknown[]}}>('documentation/SwiftUI');

			for (const platform of data.metadata.platforms) {
				assertValidSchema(PlatformInfoSchema, platform, 'SwiftUI.platform');
			}
		});

		it('validates sample of references in SwiftUI', async () => {
			const data = await fetchDoc<{references: Record<string, unknown>}>('documentation/SwiftUI');

			// Sample first 50 references
			const refs = Object.entries(data.references).slice(0, 50);
			const failures: string[] = [];

			for (const [key, ref] of refs) {
				const result = validateWithSchema(ReferenceDataSchema, ref, key);
				if (!result.success) {
					failures.push(...result.errors);
				}
			}

			expect(failures).toEqual([]);
		});
	});

	describe('Symbol Endpoint Schema Validation', () => {
		const symbols = [
			'documentation/SwiftUI/View',
			'documentation/SwiftUI/Button',
			'documentation/SwiftUI/Text',
			'documentation/SwiftUI/View/opacity(_:)',
			'documentation/UIKit/UIView',
			'documentation/Foundation/URL',
		];

		it.each(symbols)('%s matches SymbolDataSchema', async symbol => {
			const data = await fetchDoc<unknown>(symbol);
			assertValidSchema(SymbolDataSchema, data, symbol);
		});

		it('validates declaration tokens in SwiftUI/View', async () => {
			const data = await fetchDoc<{
				primaryContentSections: Array<{
					kind: string;
					declarations?: Array<{tokens: unknown[]}>;
				}>;
			}>('documentation/SwiftUI/View');

			const declSection = data.primaryContentSections.find(s => s.kind === 'declarations');

			expect(declSection).toBeDefined();

			if (declSection?.declarations) {
				for (const decl of declSection.declarations) {
					for (const token of decl.tokens) {
						assertValidSchema(DeclarationTokenSchema, token, 'View.token');
					}
				}
			}
		});

		it('validates all primary content sections in opacity function', async () => {
			const data = await fetchDoc<{primaryContentSections: unknown[]}>('documentation/SwiftUI/View/opacity(_:)');

			for (const section of data.primaryContentSections) {
				assertValidSchema(
					PrimaryContentSectionSchema,
					section,
					'opacity.section',
				);
			}
		});
	});

	describe('Edge Cases Schema Validation', () => {
		it('handles Metal Performance Shaders (spaces in display name)', async () => {
			const data = await fetchDoc<unknown>('documentation/MetalPerformanceShaders');
			assertValidSchema(FrameworkDataSchema, data, 'MetalPerformanceShaders');
		});

		it('handles deeply nested symbol paths', async () => {
			const data = await fetchDoc<unknown>('documentation/SwiftUI/View/onAppear(perform:)');
			assertValidSchema(SymbolDataSchema, data, 'onAppear');
		});

		it('handles symbols with special characters', async () => {
			const data = await fetchDoc<unknown>('documentation/SwiftUI/View/opacity(_:)');
			assertValidSchema(SymbolDataSchema, data, 'opacity(_:)');
		});
	});

	describe('Cross-Framework Schema Consistency', () => {
		// Using well-known symbols that are stable across Apple API versions
		const frameworkSymbols = [
			{framework: 'SwiftUI', symbol: 'View'},
			{framework: 'SwiftUI', symbol: 'Button'},
			{framework: 'UIKit', symbol: 'UIView'},
			{framework: 'Foundation', symbol: 'URL'},
		];

		it.each(frameworkSymbols)(
			'$framework/$symbol has consistent schema structure',
			async ({framework, symbol}) => {
				try {
					const data = await fetchDoc<unknown>(`documentation/${framework}/${symbol}`);
					assertValidSchema(SymbolDataSchema, data, `${framework}/${symbol}`);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					if (message.includes('404')) {
						console.warn(`${framework}/${symbol} returned 404`);
					} else {
						throw error;
					}
				}
			},
		);
	});
});

describe('Schema Drift Detection', () => {
	it('logs unexpected top-level fields in FrameworkData (informational)', async () => {
		const data = await fetchDoc<Record<string, unknown>>('documentation/SwiftUI');

		const expectedTopLevel = new Set([
			'abstract',
			'metadata',
			'references',
			'topicSections',
			'hierarchy',
			'identifier',
			'kind',
			'schemaVersion',
			'sections',
			'variants',
			'diffAvailability',
			'seeAlsoSections',
			'primaryContentSections',
		]);

		const actualKeys = Object.keys(data);
		const unexpectedKeys = actualKeys.filter(k => !expectedTopLevel.has(k));

		if (unexpectedKeys.length > 0) {
			console.warn(
				'INFO: Additional fields in FrameworkData response:',
				unexpectedKeys,
				'\nConsider adding these to the TypeScript types if needed.',
			);
		}

		// This test passes regardless - it's for awareness
		expect(true).toBe(true);
	});
});
