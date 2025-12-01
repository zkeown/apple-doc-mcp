import type {Technology} from '../../apple-client.js';

/**
 * Manages the currently active technology selection.
 * Technology represents a framework/API like SwiftUI, UIKit, etc.
 */
export class TechnologyState {
	private activeTechnology?: Technology;

	getActiveTechnology(): Technology | undefined {
		return this.activeTechnology;
	}

	setActiveTechnology(technology: Technology | undefined): void {
		this.activeTechnology = technology;
	}

	/**
	 * Check if technology has changed from a previous value.
	 * Useful for determining if dependent state should be reset.
	 */
	hasChanged(previousIdentifier: string | undefined): boolean {
		return previousIdentifier !== this.activeTechnology?.identifier;
	}
}
