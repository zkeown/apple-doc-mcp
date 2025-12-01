import type {FrameworkData, Technology} from '../apple-client.js';
import type {LocalSymbolIndex} from './services/local-symbol-index.js';
import {TechnologyState} from './state/technology-state.js';
import {FrameworkState, type FrameworkIndexEntry} from './state/framework-state.js';
import {SearchState, type LastDiscovery} from './state/search-state.js';

// Re-export types for backward compatibility using export...from
export {type LastDiscovery} from './state/search-state.js';
export {type FrameworkIndexEntry} from './state/framework-state.js';

/**
 * Composed server state that delegates to focused state managers.
 * Maintains the same public API for backward compatibility.
 */
export class ServerState {
	private readonly technologyState = new TechnologyState();
	private readonly frameworkState = new FrameworkState();
	private readonly searchState = new SearchState();

	// Technology state methods
	getActiveTechnology(): Technology | undefined {
		return this.technologyState.getActiveTechnology();
	}

	/**
	 * Set the active technology.
	 *
	 * **Side Effect Warning:** When the technology changes (different identifier),
	 * this method automatically resets:
	 * - Active framework data
	 * - Framework index
	 * - Expanded identifiers tracking
	 * - Local symbol index
	 *
	 * This ensures state consistency but callers should be aware that
	 * changing technologies invalidates cached search/framework data.
	 */
	setActiveTechnology(technology: Technology | undefined): void {
		const previousIdentifier = this.technologyState.getActiveTechnology()?.identifier;
		this.technologyState.setActiveTechnology(technology);

		// Auto-reset when technology actually changes
		if (this.technologyState.hasChanged(previousIdentifier)) {
			this.resetForTechnologyChange();
		}
	}

	// Framework state methods
	getActiveFrameworkData(): FrameworkData | undefined {
		return this.frameworkState.getActiveFrameworkData();
	}

	setActiveFrameworkData(data: FrameworkData | undefined): void {
		this.frameworkState.setActiveFrameworkData(data);
	}

	clearActiveFrameworkData(): void {
		this.frameworkState.clearActiveFrameworkData();
	}

	getFrameworkIndex(): Map<string, FrameworkIndexEntry> | undefined {
		return this.frameworkState.getFrameworkIndex();
	}

	setFrameworkIndex(index: Map<string, FrameworkIndexEntry> | undefined): void {
		this.frameworkState.setFrameworkIndex(index);
	}

	clearFrameworkIndex(): void {
		this.frameworkState.clearFrameworkIndex();
	}

	hasExpandedIdentifier(identifier: string): boolean {
		return this.frameworkState.hasExpandedIdentifier(identifier);
	}

	markIdentifierExpanded(identifier: string): void {
		this.frameworkState.markIdentifierExpanded(identifier);
	}

	// Search state methods
	getLastDiscovery(): LastDiscovery | undefined {
		return this.searchState.getLastDiscovery();
	}

	setLastDiscovery(lastDiscovery: LastDiscovery | undefined): void {
		this.searchState.setLastDiscovery(lastDiscovery);
	}

	getLocalSymbolIndex(): LocalSymbolIndex | undefined {
		return this.searchState.getLocalSymbolIndex();
	}

	setLocalSymbolIndex(index: LocalSymbolIndex): void {
		this.searchState.setLocalSymbolIndex(index);
	}

	clearLocalSymbolIndex(): void {
		this.searchState.clearLocalSymbolIndex();
	}

	/**
	 * Reset all technology-dependent state.
	 * Called automatically when technology changes, but can be called explicitly.
	 */
	resetForTechnologyChange(): void {
		this.frameworkState.reset();
		this.searchState.resetForTechnologyChange();
	}
}
