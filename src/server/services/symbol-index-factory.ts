import type {AppleDevDocsClient, Technology} from '../../apple-client.js';
import {LocalSymbolIndex} from './local-symbol-index.js';

/**
 * Extract the technology identifier path from a full identifier.
 */
const extractTechnologyPath = (identifier: string): string | undefined => identifier
	.replace('doc://com.apple.documentation/', '')
	.replace(/^documentation\//, '') || undefined;

/**
 * Factory function to create a LocalSymbolIndex for a given technology.
 * This decouples index creation from ServerState.
 */
export const createLocalSymbolIndex = (
	client: AppleDevDocsClient,
	technology: Technology,
): LocalSymbolIndex => {
	const technologyPath = extractTechnologyPath(technology.identifier);
	return new LocalSymbolIndex(client, technologyPath);
};
