import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import pLimit from 'p-limit';
import type {SymbolData} from '../../apple-client.js';
import type {ServerContext} from '../context.js';
import {config} from '../../config.js';
import {logger} from '../../logger.js';

/**
 * Framework prefix mappings for symbol resolution.
 * Maps symbol prefixes to framework names for faster resolution.
 */
const SYMBOL_PREFIX_MAPPINGS: Record<string, string[]> = {
	MPS: ['MetalPerformanceShaders', 'MetalPerformanceShadersGraph'],
	MTL: ['Metal'],
	CG: ['CoreGraphics'],
	CA: ['CoreAnimation'],
	CI: ['CoreImage'],
	AV: ['AVFoundation'],
	NS: ['Foundation', 'AppKit'],
	UI: ['UIKit'],
	SK: ['SpriteKit', 'StoreKit'],
	SCN: ['SceneKit'],
	CL: ['CoreLocation'],
	CM: ['CoreMedia', 'CoreMotion'],
	CN: ['Contacts'],
	PH: ['Photos'],
	WK: ['WebKit', 'WatchKit'],
};

/**
 * Try to fetch a symbol, returning undefined on failure.
 */
const tryGetSymbol = async (
	client: ServerContext['client'],
	path: string,
): Promise<SymbolData | undefined> => {
	try {
		return await client.getSymbol(path);
	} catch (error) {
		logger.debug({path, err: error}, 'Symbol not found at path');
		return undefined;
	}
};

/**
 * Get framework prefixes to try based on symbol name patterns.
 */
const getFrameworkPrefixesForSymbol = (symbolPath: string): string[] => {
	const prefixes: string[] = [];

	for (const [prefix, frameworks] of Object.entries(SYMBOL_PREFIX_MAPPINGS)) {
		if (symbolPath.startsWith(prefix)) {
			prefixes.push(...frameworks);
			break;
		}
	}

	return prefixes;
};

export type SymbolResolverOptions = {
	/** Additional framework names to try */
	additionalFrameworks?: string[];
};

/**
 * Resolve a symbol path to actual symbol data.
 * Tries multiple framework prefixes based on symbol naming conventions
 * (e.g., NS* -> Foundation/AppKit, UI* -> UIKit).
 * Uses parallel fetching with rate limiting for performance.
 *
 * @param client - API client for fetching symbol data
 * @param path - Symbol path (e.g., "View" or "documentation/SwiftUI/View")
 * @param frameworkName - Current framework context
 * @param options - Additional resolution options
 * @throws {McpError} If symbol cannot be found in any framework
 */
export const resolveSymbol = async (
	client: ServerContext['client'],
	path: string,
	frameworkName: string,
	options: SymbolResolverOptions = {},
): Promise<SymbolData> => {
	// If path already has full documentation prefix, try it directly
	if (path.startsWith('documentation/')) {
		return client.getSymbol(path);
	}

	// Try path as-is first
	const directResult = await tryGetSymbol(client, path);
	if (directResult) {
		return directResult;
	}

	// Build list of framework prefixes to try
	const frameworksToTry = new Set<string>();

	// Add prefix-based frameworks first (highest priority)
	for (const fw of getFrameworkPrefixesForSymbol(path)) {
		frameworksToTry.add(fw);
	}

	// Add the currently selected framework
	frameworksToTry.add(frameworkName);

	// Add any additional frameworks from options
	if (options.additionalFrameworks) {
		for (const fw of options.additionalFrameworks) {
			frameworksToTry.add(fw);
		}
	}

	// Try each framework prefix in parallel with rate limiting
	const frameworkList = [...frameworksToTry];
	const limit = pLimit(config.http.maxConcurrent);

	const settled = await Promise.allSettled(frameworkList.map(async fw => limit(async () => tryGetSymbol(client, `documentation/${fw}/${path}`))));

	const results = settled
		.filter((r): r is PromiseFulfilledResult<SymbolData | undefined> => r.status === 'fulfilled')
		.map(r => r.value);

	const found = results.find(r => r !== undefined);
	if (found) {
		return found;
	}

	throw new McpError(
		ErrorCode.InvalidRequest,
		`Failed to load documentation for "${path}" in frameworks: ${frameworkList.join(', ')}`,
	);
};

/**
 * Extract framework name from a technology identifier.
 * @param identifier - Full technology identifier (e.g., "doc://com.apple.documentation/documentation/SwiftUI")
 * @returns Framework name (e.g., "SwiftUI") or undefined if not found
 */
export const extractFrameworkName = (identifier: string): string | undefined => {
	const parts = identifier.split('/');
	return parts.at(-1);
};
