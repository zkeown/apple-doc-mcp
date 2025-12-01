import {ErrorCode, McpError} from '@modelcontextprotocol/sdk/types.js';
import type {ServerContext, ToolResponse} from '../context.js';
import {bold, header} from '../markdown.js';
import {loadActiveFrameworkData} from '../services/framework-loader.js';
import {resolveSymbol, extractFrameworkName} from '../services/symbol-resolver.js';
import {
	formatDetailedPlatforms,
	formatDeprecationWarnings,
	formatPrimaryContent,
	formatTopicSections,
	formatRelatedSymbols,
} from '../formatters/symbol-formatter.js';
import {buildNoTechnologyMessage} from './no-technology.js';

export const buildGetDocumentationHandler = (context: ServerContext) => {
	const {client, state} = context;
	const noTechnology = buildNoTechnologyMessage(context);

	return async (args: {path: string}): Promise<ToolResponse> => {
		const {path} = args;
		const activeTechnology = state.getActiveTechnology();
		if (!activeTechnology) {
			return noTechnology();
		}

		const framework = await loadActiveFrameworkData(context);
		const frameworkName = extractFrameworkName(activeTechnology.identifier);
		if (!frameworkName) {
			throw new McpError(
				ErrorCode.InvalidRequest,
				`Invalid technology identifier: ${activeTechnology.identifier}`,
			);
		}

		const data = await resolveSymbol(client, path, frameworkName);

		const title = data.metadata?.title || 'Symbol';
		const kind = data.metadata?.symbolKind || 'Unknown';
		const roleHeading = data.metadata?.roleHeading;
		const symbolPlatforms = data.metadata?.platforms ?? framework.metadata.platforms;
		const platforms = formatDetailedPlatforms(symbolPlatforms);
		const description = client.extractText(data.abstract);

		const content: string[] = [
			header(1, title),
			'',
			bold('Technology', activeTechnology.title),
			bold('Type', roleHeading ?? kind),
			bold('Platforms', platforms),
			...formatDeprecationWarnings(symbolPlatforms),
			...(data.primaryContentSections?.length > 0
				? formatPrimaryContent(data.primaryContentSections)
				: []),
			'',
			header(2, 'Overview'),
			description,
			...formatTopicSections(data, client),
			...(data.references ? formatRelatedSymbols(data.references, title) : []),
		];

		return {
			content: [{text: content.join('\n'), type: 'text'}],
		};
	};
};
