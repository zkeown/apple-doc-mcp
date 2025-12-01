import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {AppleDevDocsClient} from '../apple-client.js';
import {ServerState} from './state.js';
import {registerTools} from './tools.js';

/**
 * Options for creating the MCP server.
 * All options are optional - sensible defaults are used if not provided.
 */
export type CreateServerOptions = {
	/** Custom Apple Dev Docs client instance (for testing or custom configuration) */
	client?: AppleDevDocsClient;
	/** Custom server state instance (for testing or state persistence) */
	state?: ServerState;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json with validation
const packageJsonPath = join(__dirname, '../../package.json');
const packageJsonRaw: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

function getPackageVersion(data: unknown): string {
	if (data && typeof data === 'object' && 'version' in data && typeof (data as Record<string, unknown>).version === 'string') {
		return (data as {version: string}).version;
	}

	return '0.0.0'; // Fallback version if parsing fails
}

const packageVersion = getPackageVersion(packageJsonRaw);

export const createServer = (options: CreateServerOptions = {}) => {
	const mcpServer = new McpServer(
		{
			name: 'apple-dev-docs-mcp',
			version: packageVersion,
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	const client = options.client ?? new AppleDevDocsClient();
	const state = options.state ?? new ServerState();

	registerTools(mcpServer, {client, state});

	return mcpServer;
};
