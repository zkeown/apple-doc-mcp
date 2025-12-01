import {readFile, readdir, access} from 'node:fs/promises';
import {join} from 'node:path';
import {
	type AppleDevDocsClient, type SymbolData, type ReferenceData, type FrameworkData,
} from '../../apple-client.js';
import {SymbolDataSchema, FrameworkDataSchema} from '../../apple-client/types/schemas.js';
import {config} from '../../config.js';
import {tokenize, createSearchTokens} from '../utils/tokenizer.js';
import {createOperationLogger, logger} from '../../logger.js';

/** Initialization states for the symbol index */
type IndexState = 'uninitialized' | 'building' | 'ready' | 'failed';

/**
 * Read a file with a timeout to prevent indefinite hangs.
 * Uses AbortController to properly cancel the file read operation.
 */
async function readFileWithTimeout(filePath: string, timeoutMs: number = config.indexing.fileReadTimeoutMs): Promise<string> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, timeoutMs);

	try {
		const content = await readFile(filePath, {encoding: 'utf8', signal: controller.signal});
		return content;
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`File read timeout after ${timeoutMs}ms: ${filePath}`);
		}

		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

export type LocalSymbolIndexEntry = {
	id: string;
	title: string;
	path: string;
	kind: string;
	abstract: string;
	platforms: string[];
	tokens: string[];
	filePath: string;
};

export class LocalSymbolIndex {
	private readonly symbols = new Map<string, LocalSymbolIndexEntry>();
	private readonly cacheDir: string;
	private readonly technologyIdentifier?: string;
	private state: IndexState = 'uninitialized';

	constructor(private readonly client: AppleDevDocsClient, technologyIdentifier?: string) {
		// Use config-provided cache directory
		this.cacheDir = config.cache.directory;
		this.technologyIdentifier = technologyIdentifier;
	}

	/**
	 * Check if the index is ready for searching.
	 */
	isReady(): boolean {
		return this.state === 'ready';
	}

	/**
	 * Get the current initialization state.
	 */
	getState(): IndexState {
		return this.state;
	}

	/**
	 * Build the symbol index from cached files.
	 * Safe to call multiple times - will only build once.
	 */
	async buildIndexFromCache(): Promise<void> {
		if (this.state === 'ready' || this.state === 'building') {
			logger.debug({state: this.state}, 'Index already built or building, skipping');
			return;
		}

		this.state = 'building';
		const op = createOperationLogger('buildSymbolIndex', {cacheDir: this.cacheDir});
		op.info('Building local symbol index from cached files');

		try {
			// Validate cache directory exists
			try {
				await access(this.cacheDir);
			} catch {
				logger.warn({cacheDir: this.cacheDir}, 'Cache directory does not exist');
				this.state = 'ready'; // Ready but empty
				return;
			}

			// Read all JSON files in the docs directory
			const allFiles = await readdir(this.cacheDir);
			const files = allFiles.filter(file => file.endsWith('.json'));
			op.debug('Found cached files', {fileCount: files.length});

			let processedCount = 0;
			let errorCount = 0;

			// Process files in batches to avoid overwhelming I/O
			for (let index = 0; index < files.length; index += config.indexing.batchSize) {
				const batch = files.slice(index, index + config.indexing.batchSize);

				const results = await Promise.all(batch.map(async file => this.processFile(file)));

				for (const result of results) {
					if (result.success) {
						processedCount++;
					} else {
						errorCount++;
					}
				}
			}

			this.state = 'ready';
			op.success({symbolCount: this.symbols.size, processedCount, errorCount});
		} catch (error) {
			this.state = 'failed';
			op.failure(error);
			throw error;
		}
	}

	private async processFile(file: string): Promise<{success: boolean}> {
		const filePath = join(this.cacheDir, file);
		try {
			const rawData = await readFileWithTimeout(filePath);
			const parsed: unknown = JSON.parse(rawData);

			// Validate with Zod schemas before processing
			// Note: After safeParse succeeds, the data is validated. We cast to our internal
			// types which are compatible with the validated shape.
			const symbolResult = SymbolDataSchema.safeParse(parsed);
			if (symbolResult.success) {
				this.processSymbolData(symbolResult.data as SymbolData, filePath);
				return {success: true};
			}

			const frameworkResult = FrameworkDataSchema.safeParse(parsed);
			if (frameworkResult.success) {
				this.processSymbolData(frameworkResult.data as FrameworkData, filePath);
				return {success: true};
			}

			// Neither schema matched
			logger.warn({file}, 'Invalid cache data format, skipping');
			return {success: false};
		} catch (error) {
			logger.warn({file, err: error}, 'Failed to process cache file');
			return {success: false};
		}
	}

	/**
	 * Search the symbol index.
	 * Note: Will return empty results if index is not yet built.
	 * Call buildIndexFromCache() first or check isReady().
	 */
	search(query: string, maxResults = 20): LocalSymbolIndexEntry[] {
		if (this.state !== 'ready') {
			logger.debug({state: this.state, query}, 'Search called on non-ready index');
		}

		const results: Array<{entry: LocalSymbolIndexEntry; score: number}> = [];
		const queryTokens = tokenize(query);

		// Check if query contains wildcards
		const hasWildcards = query.includes('*') || query.includes('?');

		// Pre-compile regex outside loop for wildcard queries
		let wildcardRegex: RegExp | undefined;
		if (hasWildcards) {
			// Escape regex special characters except * and ? which we handle specially
			// First replace * and ? with placeholders, escape, then restore as regex patterns
			const escaped = query
				.replaceAll('*', '\u0000STAR\u0000')
				.replaceAll('?', '\u0000QUESTION\u0000')
				// Escape regex special characters: . + ^ $ { } [ ] | ( ) \
				.replaceAll(/[.+^${}[\]|()\\]/g, String.raw`\$&`)
				.replaceAll('\u0000STAR\u0000', '.*')
				.replaceAll('\u0000QUESTION\u0000', '.')
				.toLowerCase();

			try {
				wildcardRegex = new RegExp(`^${escaped}$`);
			} catch {
				// If regex is still invalid, fall back to literal search
				logger.warn({query}, 'Invalid wildcard pattern, falling back to literal search');
				wildcardRegex = undefined;
			}
		}

		for (const [id, entry] of this.symbols.entries()) {
			let score = 0;

			if (hasWildcards && wildcardRegex) {
				// Wildcard matching with pre-compiled regex
				if (wildcardRegex.test(entry.title.toLowerCase())
					|| wildcardRegex.test(entry.path.toLowerCase())
					|| entry.tokens.some(token => wildcardRegex.test(token))) {
					score = 100; // High score for wildcard matches
				}
			} else if (hasWildcards && !wildcardRegex) {
				// Fallback: treat as literal search when regex compilation fails
				const lowerQuery = query.toLowerCase();
				if (entry.title.toLowerCase().includes(lowerQuery)
					|| entry.path.toLowerCase().includes(lowerQuery)) {
					score = 50;
				}
			} else {
				// Regular token-based matching
				for (const queryToken of queryTokens) {
					if (entry.title.toLowerCase().includes(queryToken.toLowerCase())) {
						score += 50;
					}

					if (entry.tokens.includes(queryToken)) {
						score += 30;
					}

					if (entry.abstract.toLowerCase().includes(queryToken.toLowerCase())) {
						score += 10;
					}
				}
			}

			if (score > 0) {
				results.push({entry, score});
			}
		}

		return results
			.sort((a, b) => b.score - a.score)
			.slice(0, maxResults)
			.map(result => result.entry);
	}

	getSymbolCount(): number {
		return this.symbols.size;
	}

	/**
	 * Clear the index and reset state.
	 */
	clear(): void {
		this.symbols.clear();
		this.state = 'uninitialized';
	}

	private processSymbolData(data: SymbolData | FrameworkData, filePath: string): void {
		const title = data.metadata?.title || 'Unknown';
		const path = (data.metadata && 'url' in data.metadata && typeof data.metadata.url === 'string') ? data.metadata.url : '';
		const kind = (data.metadata && 'symbolKind' in data.metadata && typeof data.metadata.symbolKind === 'string') ? data.metadata.symbolKind : 'framework';
		const abstract = this.client.extractText(data.abstract);
		const platforms = data.metadata?.platforms?.map(p => p.name).filter(Boolean) || [];

		// Filter by technology if specified
		if (this.technologyIdentifier && path) {
			const technologyPath = this.technologyIdentifier.toLowerCase();
			const symbolPath = path.toLowerCase();
			if (!symbolPath.includes(technologyPath)) {
				return; // Skip symbols not from the selected technology
			}
		}

		// Create comprehensive tokens
		const tokens = createSearchTokens(title, abstract, path, platforms);

		const entry: LocalSymbolIndexEntry = {
			id: path || title,
			title,
			path,
			kind,
			abstract,
			platforms,
			tokens,
			filePath,
		};

		this.symbols.set(path || title, entry);

		// Process references recursively
		this.processReferences(data.references, filePath);
	}

	private processReferences(references: Record<string, ReferenceData> | undefined, filePath: string): void {
		if (!references) {
			return;
		}

		for (const [refId, ref] of Object.entries(references)) {
			if (ref.kind === 'symbol' && ref.title) {
				// Filter references by technology if specified
				if (this.technologyIdentifier && ref.url) {
					const technologyPath = this.technologyIdentifier.toLowerCase();
					const refPath = ref.url.toLowerCase();
					if (!refPath.includes(technologyPath)) {
						continue; // Skip references not from the selected technology
					}
				}

				const refTokens = createSearchTokens(
					ref.title,
					this.client.extractText(ref.abstract ?? []),
					ref.url || '',
					ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
				);

				const refEntry: LocalSymbolIndexEntry = {
					id: refId,
					title: ref.title,
					path: ref.url || '',
					kind: ref.kind,
					abstract: this.client.extractText(ref.abstract ?? []),
					platforms: ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
					tokens: refTokens,
					filePath,
				};

				this.symbols.set(refId, refEntry);
			}
		}
	}
}
