import type {Technology} from '../../apple-client.js';
import type {LocalSymbolIndex} from '../services/local-symbol-index.js';

export type LastDiscovery = {
	query?: string;
	results: Technology[];
};

/**
 * Manages search-related state including:
 * - Last discovery results (for technology suggestions)
 * - Local symbol index (for fast symbol lookup)
 */
export class SearchState {
	private lastDiscovery?: LastDiscovery;
	private localSymbolIndex?: LocalSymbolIndex;

	// Discovery methods
	getLastDiscovery(): LastDiscovery | undefined {
		return this.lastDiscovery;
	}

	setLastDiscovery(lastDiscovery: LastDiscovery | undefined): void {
		this.lastDiscovery = lastDiscovery;
	}

	// Local symbol index methods
	getLocalSymbolIndex(): LocalSymbolIndex | undefined {
		return this.localSymbolIndex;
	}

	setLocalSymbolIndex(index: LocalSymbolIndex): void {
		this.localSymbolIndex = index;
	}

	clearLocalSymbolIndex(): void {
		this.localSymbolIndex = undefined;
	}

	/**
	 * Reset technology-dependent search state.
	 * Call this when the active technology changes.
	 * Note: lastDiscovery is NOT reset as it's technology-independent.
	 */
	resetForTechnologyChange(): void {
		this.localSymbolIndex = undefined;
	}
}
