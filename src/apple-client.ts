import {HttpClient} from './apple-client/http-client.js';
import {FileCache} from './apple-client/cache/file-cache.js';
import {extractText, formatPlatforms} from './apple-client/formatters.js';
import type {
	FrameworkData, SymbolData, Technology, SearchResult,
} from './apple-client/types/index.js';

/**
 * Type guard to validate a Technology object from API response.
 */
const isTechnology = (value: unknown): value is Technology => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.identifier === 'string'
		&& typeof candidate.title === 'string'
		&& typeof candidate.url === 'string'
	);
};

// Re-export types for backward compatibility
export type {
	PlatformInfo,
	FrameworkData,
	SearchResult,
	SymbolData,
	Technology,
	TopicSection,
	ReferenceData,
	// New content types
	PrimaryContentSection,
	DeclarationsSection,
	ParametersSection,
	ContentSection,
	MentionsSection,
	Declaration,
	DeclarationToken,
	ContentBlock,
	InlineContent,
	ParameterContent,
	Fragment,
} from './apple-client/types/index.js';

export class AppleDevDocsClient {
	private readonly httpClient: HttpClient;
	private readonly fileCache: FileCache;

	/**
	 * Extracts plain text from Apple documentation content blocks.
	 * Bound method for backward compatibility.
	 */
	readonly extractText: typeof extractText = extractText;

	/**
	 * Formats platform availability information into a readable string.
	 * Bound method for backward compatibility.
	 */
	readonly formatPlatforms: typeof formatPlatforms = formatPlatforms;

	/**
	 * Create an AppleDevDocsClient with optional dependency injection.
	 * @param httpClient - Optional HttpClient instance. If not provided, creates default.
	 * @param fileCache - Optional FileCache instance. If not provided, creates default.
	 */
	constructor(httpClient?: HttpClient, fileCache?: FileCache) {
		this.httpClient = httpClient ?? new HttpClient();
		this.fileCache = fileCache ?? new FileCache();
	}

	async getFramework(frameworkName: string): Promise<FrameworkData> {
		const cached = await this.fileCache.loadFramework(frameworkName);
		if (cached) {
			return cached;
		}

		const data = await this.httpClient.getDocumentation<FrameworkData>(`documentation/${frameworkName}`);
		await this.fileCache.saveFramework(frameworkName, data);
		return data;
	}

	async refreshFramework(frameworkName: string): Promise<FrameworkData> {
		const data = await this.httpClient.getDocumentation<FrameworkData>(`documentation/${frameworkName}`);
		await this.fileCache.saveFramework(frameworkName, data);
		return data;
	}

	async getSymbol(path: string): Promise<SymbolData> {
		// Remove leading slash if present
		const cleanPath = path.startsWith('/') ? path.slice(1) : path;

		const cached = await this.fileCache.loadSymbol(cleanPath);
		if (cached) {
			return cached;
		}

		const data = await this.httpClient.getDocumentation<SymbolData>(cleanPath);
		await this.fileCache.saveSymbol(cleanPath, data);
		return data;
	}

	async getTechnologies(): Promise<Record<string, Technology>> {
		// Try to load from persistent cache first
		const cached = await this.fileCache.loadTechnologies();
		if (cached && Object.keys(cached).length > 0) {
			return cached;
		}

		// If no cache, download from API, parse, and save
		return this.fetchAndSaveTechnologies();
	}

	// Force refresh technologies cache (user-invoked)
	async refreshTechnologies(): Promise<Record<string, Technology>> {
		return this.fetchAndSaveTechnologies();
	}

	private async fetchAndSaveTechnologies(): Promise<Record<string, Technology>> {
		const response = await this.httpClient.getDocumentation<unknown>('documentation/technologies');
		const technologies = this.parseTechnologiesResponse(response);

		// Save the extracted technologies (not the full response)
		if (Object.keys(technologies).length > 0) {
			await this.fileCache.saveTechnologies(technologies);
		}

		return technologies;
	}

	private parseTechnologiesResponse(response: unknown): Record<string, Technology> {
		const technologies: Record<string, Technology> = {};

		if (!response || typeof response !== 'object') {
			return technologies;
		}

		// Get references object - handle different response shapes
		if (Array.isArray(response)) {
			return technologies;
		}

		const responseObject = response as Record<string, unknown>;

		// Check for references property with proper null handling
		// Note: typeof null === 'object', so we need explicit null check
		const hasValidReferences = 'references' in responseObject
			&& responseObject.references !== null
			&& typeof responseObject.references === 'object'
			&& !Array.isArray(responseObject.references);

		const refs = hasValidReferences
			? responseObject.references as Record<string, unknown>
			: responseObject;

		// Validate each entry before adding using type guard
		for (const [key, value] of Object.entries(refs)) {
			if (isTechnology(value)) {
				technologies[key] = value;
			}
		}

		return technologies;
	}

	async searchFramework(frameworkName: string, query: string, options: {
		maxResults?: number;
		platform?: string;
		symbolType?: string;
	} = {}): Promise<SearchResult[]> {
		const {maxResults = 20} = options;
		const results: SearchResult[] = [];

		try {
			const framework = await this.getFramework(frameworkName);
			const lowerQuery = query.toLowerCase();

			for (const ref of Object.values(framework.references)) {
				if (results.length >= maxResults) {
					break;
				}

				const title = ref.title ?? '';
				const abstractText = extractText(ref.abstract ?? []);
				if (!title.toLowerCase().includes(lowerQuery) && !abstractText.toLowerCase().includes(lowerQuery)) {
					continue;
				}

				if (options.symbolType && ref.kind?.toLowerCase() !== options.symbolType.toLowerCase()) {
					continue;
				}

				if (options.platform) {
					const platformLower = options.platform.toLowerCase();
					const matchesPlatform = ref.platforms?.some(p => p.name?.toLowerCase()?.includes(platformLower) ?? false) ?? false;
					if (!matchesPlatform) {
						continue;
					}
				}

				results.push({
					title: ref.title ?? 'Symbol',
					framework: frameworkName,
					path: ref.url,
					description: abstractText,
					symbolKind: ref.kind,
					platforms: formatPlatforms(ref.platforms ?? framework.metadata.platforms),
				});
			}

			return results;
		} catch (error) {
			throw new Error(
				`Framework search failed for ${frameworkName}: ${error instanceof Error ? error.message : String(error)}`,
				{cause: error},
			);
		}
	}
}
