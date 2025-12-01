#!/usr/bin/env node

import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {createServer} from './server/app.js';
import {logger} from './logger.js';

const server = createServer();
const transport = new StdioServerTransport();

// Graceful shutdown handlers
const shutdown = async (signal: string) => {
	logger.info({signal}, 'Received shutdown signal, closing server...');
	try {
		await server.close();
		logger.info('Server closed gracefully');
		process.exit(0);
	} catch (error) {
		logger.error({err: error}, 'Error during shutdown');
		process.exit(1);
	}
};

process.on('SIGTERM', () => {
	void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
	void shutdown('SIGINT');
});

try {
	await server.connect(transport);
	logger.info('Apple Developer Documentation MCP server running on stdio');
} catch (error: unknown) {
	logger.fatal({err: error}, 'Fatal error during server startup');
	process.exit(1);
}
