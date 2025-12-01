/**
 * Utilities for reproducible random sampling in tests.
 * Uses seeded random for consistent, reproducible test runs.
 */

/**
 * Creates a seeded pseudo-random number generator.
 * Uses a simple linear congruential generator for reproducibility.
 *
 * @param seed - Integer seed value
 * @returns Function that returns random numbers between 0 and 1
 */
export function createSeededRandom(seed: number): () => number {
	let state = seed;
	return () => {
		// Linear congruential generator parameters (same as glibc)
		state = (state * 1_103_515_245 + 12_345) & 0x7F_FF_FF_FF;
		return state / 0x7F_FF_FF_FF;
	};
}

/**
 * Selects a random sample from an array with optional seeding.
 *
 * @param items - Array to sample from
 * @param count - Number of items to select
 * @param seed - Optional seed for reproducibility (defaults to fixed seed)
 * @returns Array of sampled items
 */
export function selectRandomSample<T>(
	items: T[],
	count: number,
	seed = 12_345,
): T[] {
	if (count >= items.length) {
		return [...items];
	}

	const random = createSeededRandom(seed);
	const shuffled = [...items].sort(() => random() - 0.5);
	return shuffled.slice(0, count);
}

/**
 * Extracts symbol paths from framework references.
 * Filters to only include actual symbols (not articles, images, or collections).
 *
 * @param references - Record of reference data from framework response
 * @returns Array of symbol paths (e.g., "documentation/SwiftUI/View")
 */
export function extractSymbolPaths(references: Record<string, {url?: string; kind?: string; type?: string; role?: string}>): string[] {
	// Symbol kinds that represent actual code symbols
	const symbolKinds = new Set([
		'symbol',
		'protocol',
		'struct',
		'class',
		'enum',
		'func',
		'typealias',
		'property',
		'case',
		'init',
		'method',
		'operator',
		'var',
	]);

	return Object.values(references)
		.filter(ref => {
			// Must have a documentation URL
			if (!ref.url?.startsWith('/documentation/')) {
				return false;
			}

			// Exclude images
			if (ref.type === 'image') {
				return false;
			}

			// Prefer entries with symbol-like kinds
			if (ref.kind && symbolKinds.has(ref.kind)) {
				return true;
			}

			// Exclude articles and collections
			if (ref.role === 'article' || ref.role === 'collectionGroup') {
				return false;
			}

			// Include if it looks like a symbol path (has at least 3 segments)
			const segments = ref.url.split('/').filter(Boolean);
			return segments.length >= 3;
		})
		.map(ref => ref.url!.replace(/^\//, ''));
}

/**
 * Groups items by a key function and samples from each group.
 *
 * @param items - Array of items to sample
 * @param keyFn - Function to extract group key
 * @param countPerGroup - Number to sample from each group
 * @param seed - Random seed
 * @returns Array of sampled items from all groups
 */
export function sampleByGroup<T>(
	items: T[],
	keyFn: (item: T) => string,
	countPerGroup: number,
	seed = 12_345,
): T[] {
	const groups = new Map<string, T[]>();

	for (const item of items) {
		const key = keyFn(item);
		const group = groups.get(key) ?? [];
		group.push(item);
		groups.set(key, group);
	}

	const result: T[] = [];
	for (const group of groups.values()) {
		result.push(...selectRandomSample(group, countPerGroup, seed));
	}

	return result;
}

// Fixed seed for reproducible CI runs
export const TEST_SEED = 12_345;
