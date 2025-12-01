import type {ServerContext, ToolResponse} from '../context.js';
import {config} from '../../config.js';
import {createOperationLogger, logger} from '../../logger.js';
import {header, bold, trimWithEllipsis} from '../markdown.js';
import {type LocalSymbolIndexEntry} from '../services/local-symbol-index.js';
import {createLocalSymbolIndex} from '../services/symbol-index-factory.js';
import {KeyedMutex} from '../utils/mutex.js';
import {buildNoTechnologyMessage} from './no-technology.js';

// Mutex to prevent race conditions when creating local symbol indexes
const indexCreationMutex = new KeyedMutex();

// Format symbol kind with display name
const formatKind = (kind: string): string => {
	const kindMap: Record<string, string> = {
		class: 'Class',
		struct: 'Structure',
		protocol: 'Protocol',
		enum: 'Enumeration',
		func: 'Function',
		method: 'Method',
		property: 'Property',
		var: 'Variable',
		typealias: 'Type Alias',
		init: 'Initializer',
		deinit: 'Deinitializer',
		subscript: 'Subscript',
		operator: 'Operator',
		macro: 'Macro',
		symbol: 'Symbol',
	};
	return kindMap[kind.toLowerCase()] ?? kind;
};

// Extract parent context from path (e.g., "SwiftUI.View" from full path)
const extractParentContext = (path: string, title: string): string | undefined => {
	const parts = path.split('/');
	// Find the symbol in the path and get its parent
	const symbolIndex = parts.indexOf(title);
	if (symbolIndex > 1) {
		return parts[symbolIndex - 1];
	}

	return undefined;
};

export const buildSearchSymbolsHandler = (context: ServerContext) => {
	const {client, state} = context;
	const noTechnology = buildNoTechnologyMessage(context);

	return async (args: {maxResults?: number; platform?: string; query: string; symbolType?: string}): Promise<ToolResponse> => {
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return noTechnology();
		}

		const {query, maxResults = 20, platform, symbolType} = args;

		// Get or create technology-specific local index (with mutex to prevent race conditions)
		let techLocalIndex = state.getLocalSymbolIndex();
		if (!techLocalIndex) {
			const release = await indexCreationMutex.acquire(activeTechnology.identifier);
			try {
				// Double-check after acquiring lock (another request may have created it)
				techLocalIndex = state.getLocalSymbolIndex();
				if (!techLocalIndex) {
					techLocalIndex = createLocalSymbolIndex(client, activeTechnology);
					state.setLocalSymbolIndex(techLocalIndex);
				}
			} finally {
				release();
			}
		}

		const op = createOperationLogger('searchSymbols', {query, technology: activeTechnology.title});

		// Build local index from cached files if not already built
		let indexBuildFailed = false;
		if (techLocalIndex.getSymbolCount() === 0) {
			try {
				op.info('Building symbol index from cache');
				await techLocalIndex.buildIndexFromCache();
				op.debug('Index built', {symbolCount: techLocalIndex.getSymbolCount()});
			} catch (error) {
				logger.warn({err: error}, 'Failed to build local symbol index, using fallback search');
				indexBuildFailed = true;
			}
		}

		// Comprehensive download disabled - it was broken and blocking
		// If local index is empty/small, use direct framework search as fallback
		let symbolResults = techLocalIndex.search(query, maxResults * 2);

		if (symbolResults.length === 0 && techLocalIndex.getSymbolCount() < config.indexing.minSymbolCountThreshold) {
			// Fallback: search framework.references directly (fast, no download needed)
			op.debug('Using framework references for search (local index too small)');
			const frameworkResults = await client.searchFramework(activeTechnology.title, query, {maxResults: maxResults * 2, platform, symbolType});
			symbolResults = frameworkResults.map(r => ({
				id: r.path ?? r.title,
				title: r.title,
				path: r.path ?? '',
				kind: r.symbolKind ?? 'symbol',
				abstract: r.description,
				platforms: r.platforms ? r.platforms.split(', ') : [],
				tokens: [],
				filePath: '',
			}));
		}

		// Apply filters
		let filteredResults = symbolResults;
		if (platform) {
			const platformLower = platform.toLowerCase();
			filteredResults = filteredResults.filter(result =>
				result.platforms.some(p => p.toLowerCase().includes(platformLower)));
		}

		if (symbolType) {
			const typeLower = symbolType.toLowerCase();
			filteredResults = filteredResults.filter(result =>
				result.kind.toLowerCase().includes(typeLower));
		}

		filteredResults = filteredResults.slice(0, maxResults);

		// Validate result relevance
		const technologyIdentifier = activeTechnology.identifier.replace('doc://com.apple.documentation/', '').replace(/^documentation\//, '');
		const isRelevantResult = (result: LocalSymbolIndexEntry) => {
			const resultPath = result.path.toLowerCase();
			const technologyPath = technologyIdentifier.toLowerCase();
			return resultPath.includes(technologyPath);
		};

		const relevantResults = filteredResults.filter(result => isRelevantResult(result));
		const hasIrrelevantResults = relevantResults.length < filteredResults.length;

		const lines = [
			header(1, `🔍 Search Results for "${query}"`),
			'',
			bold('Technology', activeTechnology.title),
			bold('Matches', filteredResults.length.toString()),
			bold('Total Symbols Indexed', techLocalIndex.getSymbolCount().toString()),
			'',
		];

		// Add status information
		if (indexBuildFailed) {
			lines.push(
				'⚠️ **Index Unavailable:** Using fallback search (framework references only).',
				'Results may be limited. Try searching again later.',
				'',
			);
		} else if (techLocalIndex.getSymbolCount() < config.indexing.minSymbolCountThreshold) {
			lines.push(
				'⚠️ **Limited Results:** Only basic symbols are indexed.',
				'For comprehensive results, additional symbols are being downloaded in the background.',
				'',
			);
		} else {
			lines.push(
				'✅ **Comprehensive Index:** Full symbol database is available.',
				'',
			);
		}

		lines.push(header(2, 'Symbols'), '');

		// Show warning if results seem irrelevant
		if (hasIrrelevantResults && filteredResults.length > 0) {
			lines.push(
				'⚠️ **Note:** Some results may not be from the selected technology.',
				'For specific symbol names, try using `get_documentation` instead.',
				'',
			);
		}

		if (filteredResults.length > 0) {
			for (const result of filteredResults) {
				const kindDisplay = formatKind(result.kind);
				const platforms = result.platforms.length > 0 ? result.platforms.join(', ') : 'All platforms';
				const parentContext = extractParentContext(result.path, result.title);
				const titleDisplay = parentContext ? `${parentContext}.${result.title}` : result.title;
				const abstractDisplay = result.abstract ? trimWithEllipsis(result.abstract, 150) : '';

				lines.push(
					`### ${titleDisplay}`,
					`\`${kindDisplay}\` • ${platforms}`,
					'',
					abstractDisplay,
					'',
					`📄 \`${result.path}\``,
					'',
				);
			}
		} else {
			// Check if this looks like a specific symbol name that should use direct documentation lookup
			const isSpecificSymbol = /^[A-Z][a-zA-Z\d]*$/.test(query) || /^[A-Z][a-zA-Z\d]*\.[A-Z][a-zA-Z\d]*$/.test(query);

			lines.push(
				'No symbols matched those terms within this technology.',
				'',
				'**Search Tips:**',
				'• Try wildcards: `Grid*` or `*Item`',
				'• Use broader keywords: "grid" instead of "griditem"',
				'• Check spelling and try synonyms',
				'',
			);

			if (isSpecificSymbol) {
				lines.push(
					'**💡 Suggestion:** This looks like a specific symbol name.',
					'Try using `get_documentation` instead for direct access:',
					'',
					'```',
					`get_documentation { "path": "${query}" }`,
					'```',
					'',
				);
			}

			lines.push(
				'**Note:** If this is your first search, symbols are being downloaded in the background.',
				'Try searching again in a few moments for more comprehensive results.',
				'',
			);
		}

		return {
			content: [{text: lines.join('\n'), type: 'text'}],
		};
	};
};
