import {createHash} from 'node:crypto';
import {promises as fs} from 'node:fs';
import {join} from 'node:path';
import type {FrameworkData, SymbolData, Technology} from '../types/index.js';
import {FrameworkDataSchema, SymbolDataSchema} from '../types/schemas.js';
import {logger} from '../../logger.js';
import {config} from '../../config.js';

/**
 * Type guard to check if an error is a Node.js system error with an error code.
 */
function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && 'code' in error;
}

export class FileCache {
	private readonly docsDir: string;
	private readonly technologiesCachePath: string;

	constructor(baseDir?: string) {
		// If baseDir provided, create .cache subdirectory under it (for backward compatibility)
		// Otherwise use config-provided absolute path (defaults to ~/.cache/apple-doc-mcp)
		this.docsDir = baseDir ? join(baseDir, '.cache') : config.cache.directory;
		this.technologiesCachePath = join(this.docsDir, 'technologies.json');
	}

	async loadFramework(frameworkName: string): Promise<FrameworkData | undefined> {
		await this.ensureCacheDir();
		try {
			const raw = await fs.readFile(this.getCachePath(frameworkName), 'utf8');
			const parsed: unknown = JSON.parse(raw);

			// Validate against schema
			const result = FrameworkDataSchema.safeParse(parsed);
			if (!result.success) {
				logger.warn({framework: frameworkName, errors: result.error.issues}, 'Invalid framework cache data, will refetch');
				return undefined;
			}

			// Cast required: Zod's inferred type differs slightly from our explicit FrameworkData type
			return result.data as FrameworkData;
		} catch (error) {
			if (isErrnoException(error) && error.code === 'ENOENT') {
				return undefined;
			}

			// Handle corrupted JSON
			if (error instanceof SyntaxError) {
				logger.warn({framework: frameworkName, err: error}, 'Corrupted JSON in framework cache, will refetch');
				return undefined;
			}

			throw error;
		}
	}

	async saveFramework(frameworkName: string, data: FrameworkData): Promise<void> {
		await this.ensureCacheDir();
		await fs.writeFile(this.getCachePath(frameworkName), JSON.stringify(data, null, 2));
	}

	async loadSymbol(path: string): Promise<SymbolData | undefined> {
		try {
			const safePath = this.sanitizeSymbolPath(path);
			const raw = await fs.readFile(join(this.docsDir, `${safePath}.json`), 'utf8');
			const parsed: unknown = JSON.parse(raw);

			// Validate against schema
			const result = SymbolDataSchema.safeParse(parsed);
			if (!result.success) {
				logger.warn({path, errors: result.error.issues}, 'Invalid symbol cache data, will refetch');
				return undefined;
			}

			// Cast required: Zod's inferred type differs slightly from our explicit SymbolData type
			return result.data as SymbolData;
		} catch (error) {
			if (isErrnoException(error) && error.code === 'ENOENT') {
				return undefined;
			}

			// Handle corrupted JSON
			if (error instanceof SyntaxError) {
				logger.warn({path, err: error}, 'Corrupted JSON in symbol cache, will refetch');
				return undefined;
			}

			throw error;
		}
	}

	async saveSymbol(path: string, data: SymbolData): Promise<void> {
		await this.ensureCacheDir();
		const safePath = this.sanitizeSymbolPath(path);
		await fs.writeFile(join(this.docsDir, `${safePath}.json`), JSON.stringify(data, null, 2));
	}

	async loadTechnologies(): Promise<Record<string, Technology> | undefined> {
		await this.ensureCacheDir();
		try {
			const data = await fs.readFile(this.technologiesCachePath, 'utf8');
			const parsed = JSON.parse(data) as unknown;

			// Handle different possible formats of the cached data
			if (parsed && typeof parsed === 'object') {
				// First try: data has a 'references' property (new format from API)
				if ('references' in parsed) {
					const wrapper = parsed as {references?: Record<string, Technology>};
					const refs = wrapper.references ?? {};
					// Validate that we got actual technology data
					if (Object.keys(refs).length > 0) {
						return refs;
					}
				}

				// Second try: data is already the references object (legacy format)
				const direct = parsed as Record<string, Technology>;
				if (Object.keys(direct).length > 0) {
					// Check if it looks like technology data (has identifier/title fields)
					const firstValue = Object.values(direct)[0];
					if (firstValue && typeof firstValue === 'object' && ('identifier' in firstValue || 'title' in firstValue)) {
						return direct;
					}
				}
			}

			// If we got here, the cache might be corrupted or empty
			logger.warn('Technologies cache exists but appears invalid, will refetch');
			return undefined;
		} catch (error) {
			if (isErrnoException(error) && error.code === 'ENOENT') {
				return undefined;
			}

			logger.error({err: error}, 'Error loading technologies cache');
			throw error;
		}
	}

	async saveTechnologies(technologies: Record<string, Technology>): Promise<void> {
		await this.ensureCacheDir();
		await fs.writeFile(this.technologiesCachePath, JSON.stringify(technologies, null, 2));
	}

	private sanitizeFrameworkName(name: string): string {
		return name.replaceAll(/[^\w-]/gi, '_');
	}

	/**
	 * Create a collision-safe filename for symbol paths using hash.
	 * Uses SHA-256 hash (truncated to 16 chars) with a readable prefix.
	 */
	private sanitizeSymbolPath(path: string): string {
		const hash = createHash('sha256').update(path).digest('hex').slice(0, 16);
		// Extract a readable prefix from the path (last segment, sanitized)
		const segments = path.split('/').filter(Boolean);
		const lastSegment = segments.at(-1) ?? 'symbol';
		const prefix = lastSegment.replaceAll(/[^\w-]/gi, '_').slice(0, 32);
		return `${prefix}_${hash}`;
	}

	private async ensureCacheDir(): Promise<void> {
		await fs.mkdir(this.docsDir, {recursive: true});
	}

	private getCachePath(frameworkName: string): string {
		const safeName = this.sanitizeFrameworkName(frameworkName);
		return join(this.docsDir, `${safeName}.json`);
	}
}
