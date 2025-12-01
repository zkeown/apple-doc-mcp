/**
 * Integration tests for MCP tool handlers
 *
 * These tests make real HTTP requests to Apple's documentation API.
 * Run with: pnpm test:integration
 */
import {
	describe, it, expect, beforeAll, beforeEach,
} from 'vitest';
import {AppleDevDocsClient} from '../../apple-client.js';
import {ServerState} from '../state.js';
import type {ServerContext} from '../context.js';
import {buildDiscoverHandler} from './discover.js';
import {buildChooseTechnologyHandler} from './choose-technology.js';
import {buildCurrentTechnologyHandler} from './current-technology.js';
import {buildGetDocumentationHandler} from './get-documentation.js';
import {buildSearchSymbolsHandler} from './search-symbols.js';
import {buildVersionHandler} from './version.js';
import {buildCacheStatusHandler} from './cache-status.js';

// Create a real client and fresh state for integration testing
const createIntegrationContext = (): ServerContext => ({
	client: new AppleDevDocsClient(),
	state: new ServerState(),
});

describe('MCP Handler Integration Tests', () => {
	describe('discover_technologies handler', () => {
		let context: ServerContext;
		let discoverHandler: ReturnType<typeof buildDiscoverHandler>;

		beforeEach(() => {
			context = createIntegrationContext();
			discoverHandler = buildDiscoverHandler(context);
		});

		it('returns a list of Apple technologies', async () => {
			const result = await discoverHandler({});

			expect(result.content).toHaveLength(1);
			expect(result.content[0].type).toBe('text');

			const {text} = result.content[0];
			expect(text).toContain('Discover Apple Technologies');
			expect(text).toContain('Total frameworks');
			// Should have many frameworks - check for the number pattern
			expect(text).toMatch(/Total frameworks.*\d+/);
		});

		it('filters technologies by query', async () => {
			const result = await discoverHandler({query: 'swift'});

			const {text} = result.content[0];
			expect(text).toContain('filtered by "swift"');
			// Should find SwiftUI
			expect(text.toLowerCase()).toContain('swiftui');
		});

		it('supports pagination', async () => {
			const page1 = await discoverHandler({pageSize: 5, page: 1});
			const page2 = await discoverHandler({pageSize: 5, page: 2});

			const text1 = page1.content[0].text;
			const text2 = page2.content[0].text;

			// Check that page info is present (format may vary)
			expect(text1).toMatch(/Page.*1/);
			expect(text2).toMatch(/Page.*2/);
			// Content should be different
			expect(text1).not.toBe(text2);
		});

		it('updates state with last discovery', async () => {
			await discoverHandler({query: 'ui'});

			const lastDiscovery = context.state.getLastDiscovery();
			expect(lastDiscovery).toBeDefined();
			expect(lastDiscovery?.query).toBe('ui');
			expect(lastDiscovery?.results.length).toBeGreaterThan(0);
		});
	});

	describe('choose_technology handler', () => {
		let context: ServerContext;
		let chooseHandler: ReturnType<typeof buildChooseTechnologyHandler>;

		beforeEach(() => {
			context = createIntegrationContext();
			chooseHandler = buildChooseTechnologyHandler(context);
		});

		it('selects SwiftUI by name', async () => {
			const result = await chooseHandler({name: 'SwiftUI'});

			const {text} = result.content[0];
			expect(text).toContain('Technology Selected');
			expect(text).toContain('SwiftUI');
			// Identifier contains SwiftUI (case-insensitive check)
			expect(text.toLowerCase()).toContain('swiftui');

			// Should set active technology in state
			const active = context.state.getActiveTechnology();
			expect(active).toBeDefined();
			expect(active?.title).toBe('SwiftUI');
		});

		it('selects technology case-insensitively', async () => {
			const result = await chooseHandler({name: 'swiftui'});

			const {text} = result.content[0];
			expect(text).toContain('Technology Selected');

			const active = context.state.getActiveTechnology();
			expect(active?.title).toBe('SwiftUI');
		});

		it('returns framework overview with platform info', async () => {
			const result = await chooseHandler({name: 'SwiftUI'});

			const {text} = result.content[0];
			expect(text).toContain('Framework Overview');
			expect(text).toContain('Platforms');
			expect(text).toMatch(/iOS|macOS|watchOS|tvOS/);
		});

		it('returns suggestions when technology not found', async () => {
			const result = await chooseHandler({name: 'NonExistentFramework'});

			const {text} = result.content[0];
			expect(text).toContain('Technology Not Found');
			expect(text).toContain('discover_technologies');
		});

		it('returns not found for exact non-existent technology', async () => {
			// A very specific non-existent name that won't fuzzy-match
			const result = await chooseHandler({name: 'ZZZZZ_NonExistent_Framework_12345'});

			const {text} = result.content[0];
			expect(text).toContain('Technology Not Found');
		});
	});

	describe('current_technology handler', () => {
		let context: ServerContext;
		let currentHandler: ReturnType<typeof buildCurrentTechnologyHandler>;
		let chooseHandler: ReturnType<typeof buildChooseTechnologyHandler>;

		beforeEach(() => {
			context = createIntegrationContext();
			currentHandler = buildCurrentTechnologyHandler(context);
			chooseHandler = buildChooseTechnologyHandler(context);
		});

		it('returns no technology message when none selected', async () => {
			const result = await currentHandler();

			const {text} = result.content[0];
			expect(text).toContain('No Technology Selected');
			expect(text).toContain('discover_technologies');
		});

		it('returns current technology after selection', async () => {
			await chooseHandler({name: 'SwiftUI'});
			const result = await currentHandler();

			const {text} = result.content[0];
			expect(text).toContain('SwiftUI');
			expect(text).toContain('search_symbols');
		});
	});

	describe('get_documentation handler', () => {
		let context: ServerContext;
		let getDocHandler: ReturnType<typeof buildGetDocumentationHandler>;
		let chooseHandler: ReturnType<typeof buildChooseTechnologyHandler>;

		beforeAll(async () => {
			// Set up context with SwiftUI selected (shared setup)
			context = createIntegrationContext();
			chooseHandler = buildChooseTechnologyHandler(context);
			getDocHandler = buildGetDocumentationHandler(context);
			await chooseHandler({name: 'SwiftUI'});
		});

		it('returns no technology error when none selected', async () => {
			const freshContext = createIntegrationContext();
			const freshHandler = buildGetDocumentationHandler(freshContext);

			const result = await freshHandler({path: 'documentation/SwiftUI/View'});

			const {text} = result.content[0];
			expect(text).toContain('No Technology Selected');
		});

		it('fetches documentation for View protocol with full path', async () => {
			const result = await getDocHandler({path: 'documentation/SwiftUI/View'});

			const {text} = result.content[0];
			expect(text).toContain('View');
			expect(text).toContain('Protocol');
			expect(text).toContain('SwiftUI');
			expect(text).toContain('Declaration');
		});

		it('fetches documentation for Button struct with full path', async () => {
			const result = await getDocHandler({path: 'documentation/SwiftUI/Button'});

			const {text} = result.content[0];
			expect(text).toContain('Button');
			expect(text).toContain('Structure');
		});

		it('fetches documentation for Text with full path', async () => {
			const result = await getDocHandler({path: 'documentation/SwiftUI/Text'});

			const {text} = result.content[0];
			expect(text).toContain('Text');
		});

		it('includes platform availability', async () => {
			const result = await getDocHandler({path: 'documentation/SwiftUI/View'});

			const {text} = result.content[0];
			// Should have iOS and macOS availability
			expect(text).toMatch(/iOS|macOS/);
		});

		it('includes declaration section', async () => {
			const result = await getDocHandler({path: 'documentation/SwiftUI/View'});

			const {text} = result.content[0];
			expect(text).toContain('Declaration');
			expect(text).toContain('protocol');
		});

		it('handles function symbols with parameters', async () => {
			const result = await getDocHandler({path: 'documentation/SwiftUI/View/opacity(_:)'});

			const {text} = result.content[0];
			expect(text).toContain('opacity');
		});

		it('throws error for non-existent symbol', async () => {
			await expect(getDocHandler({path: 'documentation/SwiftUI/NonExistentSymbol12345'})).rejects.toThrow();
		});
	});

	describe('search_symbols handler', () => {
		let context: ServerContext;
		let searchHandler: ReturnType<typeof buildSearchSymbolsHandler>;
		let chooseHandler: ReturnType<typeof buildChooseTechnologyHandler>;

		beforeAll(async () => {
			context = createIntegrationContext();
			chooseHandler = buildChooseTechnologyHandler(context);
			searchHandler = buildSearchSymbolsHandler(context);
			await chooseHandler({name: 'SwiftUI'});
		});

		it('returns no technology error when none selected', async () => {
			const freshContext = createIntegrationContext();
			const freshHandler = buildSearchSymbolsHandler(freshContext);

			const result = await freshHandler({query: 'Button'});

			const {text} = result.content[0];
			expect(text).toContain('No Technology Selected');
		});

		it('searches for symbols by keyword', async () => {
			const result = await searchHandler({query: 'Button'});

			const {text} = result.content[0];
			expect(text).toContain('Search Results');
			expect(text).toContain('SwiftUI');
		});

		it('respects maxResults parameter', async () => {
			const result = await searchHandler({query: 'View', maxResults: 3});

			const {text} = result.content[0];
			// Count the number of ### headers (each result has one)
			const resultCount = (text.match(/^### /gm) || []).length;
			expect(resultCount).toBeLessThanOrEqual(3);
		});

		it('provides search tips when no results', async () => {
			const result = await searchHandler({query: 'xyznonexistent123'});

			const {text} = result.content[0];
			expect(text).toContain('No symbols matched');
			expect(text).toContain('Search Tips');
		});

		it('handles PascalCase queries', async () => {
			const result = await searchHandler({query: 'SomeSpecificSymbolName'});

			const {text} = result.content[0];
			// Should either find results or show search tips
			expect(text).toContain('Search Results');
		});
	});

	describe('get_version handler', () => {
		let versionHandler: ReturnType<typeof buildVersionHandler>;

		beforeEach(() => {
			versionHandler = buildVersionHandler();
		});

		it('returns version information', async () => {
			const result = await versionHandler();

			const {text} = result.content[0];
			expect(text).toContain('Version');
			// Should have semver-like version
			expect(text).toMatch(/\d+\.\d+\.\d+/);
		});

		it('includes server name', async () => {
			const result = await versionHandler();

			const {text} = result.content[0];
			expect(text).toContain('apple-doc-mcp');
		});

		it('includes description and author', async () => {
			const result = await versionHandler();

			const {text} = result.content[0];
			expect(text).toContain('Description');
			expect(text).toContain('Author');
		});
	});

	describe('cache_status handler', () => {
		let cacheHandler: ReturnType<typeof buildCacheStatusHandler>;

		beforeEach(() => {
			cacheHandler = buildCacheStatusHandler();
		});

		it('returns cache status information', async () => {
			const result = await cacheHandler();

			const {text} = result.content[0];
			expect(text).toContain('Cache Status');
			expect(text).toContain('Location');
		});

		it('shows cache statistics or creation message', async () => {
			const result = await cacheHandler();

			const {text} = result.content[0];
			// Either shows stats (if cache exists) or creation message
			const hasStats = text.includes('Statistics') || text.includes('Total Files');
			const hasCreationMessage = text.includes('Cache directory does not exist');
			expect(hasStats || hasCreationMessage).toBe(true);
		});
	});
});

describe('User Flow Integration Tests', () => {
	describe('Complete documentation lookup flow', () => {
		it('discover → choose → get_documentation', async () => {
			const context = createIntegrationContext();

			// Step 1: Discover technologies
			const discoverHandler = buildDiscoverHandler(context);
			const discoverResult = await discoverHandler({query: 'swift'});
			expect(discoverResult.content[0].text).toContain('SwiftUI');

			// Step 2: Choose SwiftUI
			const chooseHandler = buildChooseTechnologyHandler(context);
			const chooseResult = await chooseHandler({name: 'SwiftUI'});
			expect(chooseResult.content[0].text).toContain('Technology Selected');

			// Step 3: Get documentation for View (using full path)
			const getDocHandler = buildGetDocumentationHandler(context);
			const docResult = await getDocHandler({path: 'documentation/SwiftUI/View'});
			expect(docResult.content[0].text).toContain('View');
			expect(docResult.content[0].text).toContain('Protocol');
		});
	});

	describe('Technology switching flow', () => {
		it('properly resets state when switching technologies', async () => {
			const context = createIntegrationContext();
			const chooseHandler = buildChooseTechnologyHandler(context);
			const getDocHandler = buildGetDocumentationHandler(context);

			// Choose SwiftUI first
			await chooseHandler({name: 'SwiftUI'});
			expect(context.state.getActiveTechnology()?.title).toBe('SwiftUI');

			// Get documentation in SwiftUI (using full path)
			const swiftUIDoc = await getDocHandler({path: 'documentation/SwiftUI/View'});
			expect(swiftUIDoc.content[0].text).toContain('SwiftUI');

			// Switch to UIKit
			await chooseHandler({name: 'UIKit'});
			expect(context.state.getActiveTechnology()?.title).toBe('UIKit');

			// Get documentation in UIKit (using full path)
			const uikitDoc = await getDocHandler({path: 'documentation/UIKit/UIView'});
			expect(uikitDoc.content[0].text).toContain('UIKit');
		});
	});

	describe('Search flow', () => {
		it('discover → choose → search → get_documentation', async () => {
			const context = createIntegrationContext();

			// Choose Foundation
			const chooseHandler = buildChooseTechnologyHandler(context);
			await chooseHandler({name: 'Foundation'});

			// Search for Date
			const searchHandler = buildSearchSymbolsHandler(context);
			const searchResult = await searchHandler({query: 'Date', maxResults: 5});
			expect(searchResult.content[0].text).toContain('Search Results');

			// Get documentation for a specific symbol (using full path)
			const getDocHandler = buildGetDocumentationHandler(context);
			const docResult = await getDocHandler({path: 'documentation/Foundation/Date'});
			expect(docResult.content[0].text).toContain('Date');
		});
	});
});
