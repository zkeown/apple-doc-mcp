/**
 * Unit tests for FileCache
 *
 * Tests file-based caching with temporary directories.
 */
import {
	mkdtemp, rm, readdir, readFile,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
	describe, it, expect, beforeEach, afterEach,
} from 'vitest';
import {
	mockSwiftUIFramework,
	mockViewSymbol,
	mockSwiftUITechnology,
	mockUIKitTechnology,
} from '../../test-utils/fixtures.js';
import {FileCache} from './file-cache.js';

describe('FileCache', () => {
	let temporaryDir: string;
	let cache: FileCache;

	beforeEach(async () => {
		// Create a unique temp directory for each test
		temporaryDir = await mkdtemp(join(tmpdir(), 'apple-doc-mcp-test-'));
		cache = new FileCache(temporaryDir);
	});

	afterEach(async () => {
		// Clean up temp directory
		await rm(temporaryDir, {recursive: true, force: true});
	});

	describe('Framework Caching', () => {
		it('saves and loads framework data', async () => {
			await cache.saveFramework('SwiftUI', mockSwiftUIFramework);
			const loaded = await cache.loadFramework('SwiftUI');

			expect(loaded).toBeDefined();
			expect(loaded?.metadata.title).toBe('SwiftUI');
			expect(loaded?.references).toBeDefined();
		});

		it('returns undefined for non-existent framework', async () => {
			const loaded = await cache.loadFramework('NonExistent');

			expect(loaded).toBeUndefined();
		});

		it('overwrites existing framework cache', async () => {
			const modifiedFramework = {
				...mockSwiftUIFramework,
				metadata: {...mockSwiftUIFramework.metadata, title: 'Modified'},
			};

			await cache.saveFramework('SwiftUI', mockSwiftUIFramework);
			await cache.saveFramework('SwiftUI', modifiedFramework);
			const loaded = await cache.loadFramework('SwiftUI');

			expect(loaded?.metadata.title).toBe('Modified');
		});

		it('sanitizes framework names with special characters', async () => {
			await cache.saveFramework('Metal Performance Shaders', mockSwiftUIFramework);
			const loaded = await cache.loadFramework('Metal Performance Shaders');

			expect(loaded).toBeDefined();

			// Check the file was created with sanitized name
			const files = await readdir(join(temporaryDir, '.cache'));
			const hasFile = files.some(f => f.includes('Metal_Performance_Shaders'));
			expect(hasFile).toBe(true);
		});

		it('creates cache directory if it does not exist', async () => {
			const newTemporaryDir = join(temporaryDir, 'nested', 'cache', 'dir');
			const newCache = new FileCache(newTemporaryDir);

			await newCache.saveFramework('Test', mockSwiftUIFramework);
			const loaded = await newCache.loadFramework('Test');

			expect(loaded).toBeDefined();
		});
	});

	describe('Symbol Caching', () => {
		it('saves and loads symbol data', async () => {
			const path = 'documentation/SwiftUI/View';
			await cache.saveSymbol(path, mockViewSymbol);
			const loaded = await cache.loadSymbol(path);

			expect(loaded).toBeDefined();
			expect(loaded?.metadata.title).toBe('View');
		});

		it('returns undefined for non-existent symbol', async () => {
			const loaded = await cache.loadSymbol('documentation/NonExistent/Symbol');

			expect(loaded).toBeUndefined();
		});

		it('handles paths with slashes by replacing them', async () => {
			const path = 'documentation/SwiftUI/View/opacity(_:)';
			await cache.saveSymbol(path, mockViewSymbol);

			// Check the file was created with slashes replaced
			const files = await readdir(join(temporaryDir, '.cache'));
			const hasFile = files.some(f => f.includes('__') && f.endsWith('.json'));
			expect(hasFile).toBe(true);
		});

		it('preserves full symbol data structure', async () => {
			const path = 'documentation/SwiftUI/View';
			await cache.saveSymbol(path, mockViewSymbol);
			const loaded = await cache.loadSymbol(path);

			expect(loaded?.abstract).toBeDefined();
			expect(loaded?.metadata).toBeDefined();
			expect(loaded?.primaryContentSections).toBeDefined();
			expect(loaded?.references).toBeDefined();
			expect(loaded?.topicSections).toBeDefined();
		});
	});

	describe('Technologies Caching', () => {
		it('saves and loads technologies in direct format', async () => {
			const technologies = {
				[mockSwiftUITechnology.identifier]: mockSwiftUITechnology,
				[mockUIKitTechnology.identifier]: mockUIKitTechnology,
			};

			await cache.saveTechnologies(technologies);
			const loaded = await cache.loadTechnologies();

			expect(loaded).toBeDefined();
			expect(Object.keys(loaded ?? {}).length).toBe(2);
		});

		it('returns undefined for non-existent technologies cache', async () => {
			const loaded = await cache.loadTechnologies();

			expect(loaded).toBeUndefined();
		});

		it('handles references wrapper format (legacy)', async () => {
			// Manually write a file in the wrapper format
			const wrapped = {
				references: {
					[mockSwiftUITechnology.identifier]: mockSwiftUITechnology,
				},
			};
			const cacheDir = join(temporaryDir, '.cache');
			await import('node:fs/promises').then(async fs => fs.mkdir(cacheDir, {recursive: true}));
			await import('node:fs/promises').then(async fs =>
				fs.writeFile(join(cacheDir, 'technologies.json'), JSON.stringify(wrapped)));

			const loaded = await cache.loadTechnologies();

			expect(loaded).toBeDefined();
			expect(loaded?.[mockSwiftUITechnology.identifier]).toBeDefined();
		});

		it('returns undefined for invalid cache format', async () => {
			// Write invalid data
			const cacheDir = join(temporaryDir, '.cache');
			await import('node:fs/promises').then(async fs => fs.mkdir(cacheDir, {recursive: true}));
			await import('node:fs/promises').then(async fs =>
				fs.writeFile(join(cacheDir, 'technologies.json'), JSON.stringify({invalid: 'data'})));

			const loaded = await cache.loadTechnologies();

			expect(loaded).toBeUndefined();
		});

		it('returns undefined for empty references', async () => {
			const cacheDir = join(temporaryDir, '.cache');
			await import('node:fs/promises').then(async fs => fs.mkdir(cacheDir, {recursive: true}));
			await import('node:fs/promises').then(async fs =>
				fs.writeFile(join(cacheDir, 'technologies.json'), JSON.stringify({references: {}})));

			const loaded = await cache.loadTechnologies();

			expect(loaded).toBeUndefined();
		});
	});

	describe('Cache File Structure', () => {
		it('stores framework files in .cache directory', async () => {
			await cache.saveFramework('SwiftUI', mockSwiftUIFramework);

			const cacheDir = join(temporaryDir, '.cache');
			const files = await readdir(cacheDir);

			expect(files).toContain('SwiftUI.json');
		});

		it('stores symbol files with hash-based collision-safe names', async () => {
			await cache.saveSymbol('documentation/SwiftUI/View', mockViewSymbol);

			const cacheDir = join(temporaryDir, '.cache');
			const files = await readdir(cacheDir);

			// Filename format: {lastSegment}_{hash}.json
			// Hash is first 16 chars of SHA256 of the full path
			expect(files.some(f => f.startsWith('View_') && f.endsWith('.json'))).toBe(true);
		});

		it('stores technologies in technologies.json', async () => {
			await cache.saveTechnologies({[mockSwiftUITechnology.identifier]: mockSwiftUITechnology});

			const cacheDir = join(temporaryDir, '.cache');
			const files = await readdir(cacheDir);

			expect(files).toContain('technologies.json');
		});

		it('writes valid JSON to files', async () => {
			await cache.saveFramework('SwiftUI', mockSwiftUIFramework);

			const content = await readFile(join(temporaryDir, '.cache', 'SwiftUI.json'), 'utf8');
			const parsed = JSON.parse(content);

			expect(parsed.metadata.title).toBe('SwiftUI');
		});

		it('formats JSON with indentation', async () => {
			await cache.saveFramework('SwiftUI', mockSwiftUIFramework);

			const content = await readFile(join(temporaryDir, '.cache', 'SwiftUI.json'), 'utf8');

			// Should have newlines (formatted)
			expect(content).toContain('\n');
			// Should have indentation
			expect(content).toMatch(/^\s{2}/m);
		});
	});

	describe('Error Handling', () => {
		it('handles concurrent writes gracefully', async () => {
			const writes = Array.from({length: 10}, async (_, i) =>
				cache.saveFramework(`Framework${i}`, mockSwiftUIFramework));

			await expect(Promise.all(writes)).resolves.toBeDefined();

			// All files should exist
			const cacheDir = join(temporaryDir, '.cache');
			const files = await readdir(cacheDir);
			expect(files.length).toBe(10);
		});

		it('handles special characters in symbol paths', async () => {
			const specialPath = 'documentation/SwiftUI/View/opacity(_:)';
			await cache.saveSymbol(specialPath, mockViewSymbol);
			const loaded = await cache.loadSymbol(specialPath);

			expect(loaded).toBeDefined();
		});

		it('returns undefined for corrupted JSON in framework cache', async () => {
			// Manually write corrupted JSON
			const cacheDir = join(temporaryDir, '.cache');
			await import('node:fs/promises').then(async fs => fs.mkdir(cacheDir, {recursive: true}));
			await import('node:fs/promises').then(async fs =>
				fs.writeFile(join(cacheDir, 'Corrupted.json'), '{invalid json'));

			const loaded = await cache.loadFramework('Corrupted');

			expect(loaded).toBeUndefined();
		});

		it('returns undefined for schema-invalid framework cache', async () => {
			// Write valid JSON but invalid schema
			const cacheDir = join(temporaryDir, '.cache');
			await import('node:fs/promises').then(async fs => fs.mkdir(cacheDir, {recursive: true}));
			await import('node:fs/promises').then(async fs =>
				fs.writeFile(join(cacheDir, 'Invalid.json'), JSON.stringify({notAFramework: true})));

			const loaded = await cache.loadFramework('Invalid');

			expect(loaded).toBeUndefined();
		});

		it('returns undefined for corrupted JSON in symbol cache', async () => {
			const cacheDir = join(temporaryDir, '.cache');
			await import('node:fs/promises').then(async fs => fs.mkdir(cacheDir, {recursive: true}));
			await import('node:fs/promises').then(async fs =>
				fs.writeFile(join(cacheDir, 'documentation__corrupted__symbol.json'), 'not valid json'));

			const loaded = await cache.loadSymbol('documentation/corrupted/symbol');

			expect(loaded).toBeUndefined();
		});

		it('returns undefined for schema-invalid symbol cache', async () => {
			const cacheDir = join(temporaryDir, '.cache');
			await import('node:fs/promises').then(async fs => fs.mkdir(cacheDir, {recursive: true}));
			await import('node:fs/promises').then(async fs =>
				fs.writeFile(join(cacheDir, 'documentation__invalid__schema.json'), JSON.stringify({wrong: 'schema'})));

			const loaded = await cache.loadSymbol('documentation/invalid/schema');

			expect(loaded).toBeUndefined();
		});
	});
});
