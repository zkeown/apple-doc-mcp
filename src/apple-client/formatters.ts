import type {PlatformInfo} from './types/index.js';

// Helper to extract text from abstract array
export const extractText = (abstract: Array<{text: string; type: string}> = []): string => abstract.map(item => item.text).join('');

// Helper to format platform availability
export const formatPlatforms = (platforms?: PlatformInfo[]): string => {
	if (!platforms || platforms.length === 0) {
		return 'All platforms';
	}

	return platforms
		.map(p => {
			const version = p.introducedAt ?? 'unknown';
			const beta = p.beta ? ' (Beta)' : '';
			return `${p.name} ${version}${beta}`;
		})
		.join(', ');
};
