import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import pLimit from 'p-limit';
import type {FrameworkData, ReferenceData, SymbolData} from '../../apple-client.js';
import type {ServerContext} from '../context.js';
import {config} from '../../config.js';
import {createSearchTokens} from '../utils/tokenizer.js';
import {logger} from '../../logger.js';

/**
 * Load framework data for the currently active technology.
 * Returns cached data if available, otherwise fetches from API.
 * @throws {McpError} If no technology is selected or identifier is invalid
 */
export const loadActiveFrameworkData = async ({client, state}: ServerContext): Promise<FrameworkData> => {
	const activeTechnology = state.getActiveTechnology();
	if (!activeTechnology) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			'No technology selected. Use `discover_technologies` then `choose_technology` first.',
		);
	}

	const cached = state.getActiveFrameworkData();
	if (cached) {
		return cached;
	}

	const identifierParts = activeTechnology.identifier.split('/');
	const frameworkName = identifierParts.at(-1);
	if (!frameworkName) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			`Invalid technology identifier: ${activeTechnology.identifier}`,
		);
	}

	const data = await client.getFramework(frameworkName);
	state.setActiveFrameworkData(data);
	state.clearFrameworkIndex();
	return data;
};

const buildEntry = (id: string, ref: ReferenceData, extractText: (abstract?: ReferenceData['abstract']) => string) => {
	const abstractText = extractText(ref.abstract);
	const tokens = createSearchTokens(
		ref.title ?? '',
		abstractText,
		ref.url ?? '',
		ref.platforms?.map(p => p.name).filter(Boolean) ?? [],
	);
	return {id, ref, tokens};
};

const processReferences = (
	references: Record<string, ReferenceData>,
	index: Map<string, {id: string; ref: ReferenceData; tokens: string[]}>,
	extractText: (abstract?: ReferenceData['abstract']) => string,
) => {
	for (const [id, ref] of Object.entries(references)) {
		if (!index.has(id)) {
			index.set(id, buildEntry(id, ref, extractText));
		}
	}
};

/**
 * Ensure a searchable index exists for the active framework.
 * Creates the index from framework references if not already cached.
 * @returns Map of reference IDs to indexed entries with search tokens
 */
export const ensureFrameworkIndex = async (context: ServerContext) => {
	const {client, state} = context;
	const framework = await loadActiveFrameworkData(context);
	const existing = state.getFrameworkIndex();
	if (existing) {
		return existing;
	}

	const index = new Map<string, {id: string; ref: ReferenceData; tokens: string[]}>();
	const extract = client.extractText.bind(client);

	processReferences(framework.references, index, extract);

	state.setFrameworkIndex(index);

	return index;
};

/**
 * Expand symbol references by fetching additional symbol data.
 * Adds nested references to the framework index for deeper search.
 * Uses rate limiting and parallel fetching for performance.
 * @param context - Server context with client and state
 * @param identifiers - Array of symbol identifiers to expand
 * @returns Updated framework index map
 */
export const expandSymbolReferences = async (
	context: ServerContext,
	identifiers: string[],
): Promise<Map<string, {id: string; ref: ReferenceData; tokens: string[]}>> => {
	const {client, state} = context;
	const activeTechnology = state.getActiveTechnology();
	if (!activeTechnology) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			'No technology selected. Use `discover_technologies` then `choose_technology` first.',
		);
	}

	const identifierParts = activeTechnology.identifier.split('/');
	const frameworkName = identifierParts.at(-1);
	if (!frameworkName) {
		throw new McpError(
			ErrorCode.InvalidRequest,
			`Invalid technology identifier: ${activeTechnology.identifier}`,
		);
	}

	const index = (await ensureFrameworkIndex(context));

	const identifiersToProcess = identifiers.filter(identifier => !state.hasExpandedIdentifier(identifier));

	// Rate limit parallel API requests
	const limit = pLimit(config.http.maxConcurrent);

	const promises = identifiersToProcess.map(async identifier => limit(async () => {
		try {
			const symbolPath = identifier
				.replace('doc://com.apple.documentation/', '')
				.replace(/^documentation\//, 'documentation/');
			const data: SymbolData = await client.getSymbol(symbolPath);
			return {data, identifier};
		} catch (error) {
			logger.warn({identifier, err: error}, 'Failed to expand identifier');
			return undefined;
		}
	}));

	const settled = await Promise.allSettled(promises);
	const results = settled
		.filter((r): r is PromiseFulfilledResult<{data: SymbolData; identifier: string} | undefined> => r.status === 'fulfilled')
		.map(r => r.value);

	for (const result of results) {
		if (result) {
			const {data, identifier} = result;
			processReferences(data.references, index, client.extractText.bind(client));
			state.markIdentifierExpanded(identifier);
		}
	}

	return index;
};

/**
 * Get all entries from the framework index as an array.
 * Ensures the index is built first if needed.
 */
export const getFrameworkIndexEntries = async (context: ServerContext) => {
	const index = await ensureFrameworkIndex(context);
	return [...index.values()];
};

