import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		include: ['src/**/*.test.ts'],
		exclude: ['src/**/*.integration.test.ts', 'node_modules/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			exclude: [
				'node_modules/**',
				'dist/**',
				'src/**/*.test.ts',
				'src/**/*.integration.test.ts',
				'src/test-utils/**',
				// Entry points (minimal code, tested via integration)
				'src/index.ts',
				'src/server/app.ts',
				'src/server/tools.ts',
				'src/server/context.ts',
			],
			thresholds: {
				statements: 85,
				branches: 80,
				functions: 85,
				lines: 85,
			},
		},
	},
});
