import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		include: ['src/**/*.integration.test.ts'],
		testTimeout: 60_000, // 60 seconds for broader API coverage tests
		hookTimeout: 60_000,
	},
});
