import type {FrameworkData, ReferenceData} from '../../apple-client.js';

export type FrameworkIndexEntry = {
	id: string;
	ref: ReferenceData;
	tokens: string[];
};

/**
 * Manages framework-related state including:
 * - Active framework data (the loaded framework documentation)
 * - Framework index (searchable index of framework symbols)
 * - Expanded identifiers (tracking which doc references have been loaded)
 */
export class FrameworkState {
	private activeFrameworkData?: FrameworkData;
	private frameworkIndex?: Map<string, FrameworkIndexEntry>;
	private readonly expandedIdentifiers = new Set<string>();

	// Framework data methods
	getActiveFrameworkData(): FrameworkData | undefined {
		return this.activeFrameworkData;
	}

	setActiveFrameworkData(data: FrameworkData | undefined): void {
		this.activeFrameworkData = data;
	}

	clearActiveFrameworkData(): void {
		this.activeFrameworkData = undefined;
	}

	// Framework index methods
	getFrameworkIndex(): Map<string, FrameworkIndexEntry> | undefined {
		return this.frameworkIndex;
	}

	setFrameworkIndex(index: Map<string, FrameworkIndexEntry> | undefined): void {
		this.frameworkIndex = index;
	}

	clearFrameworkIndex(): void {
		this.frameworkIndex = undefined;
		this.expandedIdentifiers.clear();
	}

	// Expanded identifiers methods
	hasExpandedIdentifier(identifier: string): boolean {
		return this.expandedIdentifiers.has(identifier);
	}

	markIdentifierExpanded(identifier: string): void {
		this.expandedIdentifiers.add(identifier);
	}

	/**
	 * Reset all framework-related state.
	 * Call this when the active technology changes.
	 */
	reset(): void {
		this.activeFrameworkData = undefined;
		this.frameworkIndex = undefined;
		this.expandedIdentifiers.clear();
	}
}
