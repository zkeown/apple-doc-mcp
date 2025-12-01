const config = {
	rules: {
		// Allow PascalCase for schema variable names and constants
		'@typescript-eslint/naming-convention': 'off',
		// Allow kebab-case file names
		'unicorn/filename-case': 'off',
		// Allow abbreviations
		'unicorn/prevent-abbreviations': 'off',
		// Allow passthrough() in Zod schemas
		'@typescript-eslint/no-deprecated': 'off',
		// Allow await in loops
		'no-await-in-loop': 'off',
		// Allow then/catch
		'promise/prefer-await-to-then': 'off',
		// Allow process global
		'n/prefer-global/process': 'off',
		// Allow bitwise
		'no-bitwise': 'off',
		// Allow mixed operators
		'@stylistic/no-mixed-operators': 'off',
		// Allow type assertions
		'@typescript-eslint/consistent-type-assertions': 'off',
		// Allow || for defaults
		'@typescript-eslint/prefer-nullish-coalescing': 'off',
		// Allow flexible member ordering
		'@typescript-eslint/member-ordering': 'off',
		// Allow import() type annotations
		'@typescript-eslint/consistent-type-imports': 'off',
		// Allow unsafe assignment
		'@typescript-eslint/no-unsafe-assignment': 'off',
		// Allow higher complexity
		complexity: ['warn', 30],
	},
	ignores: [
		'dist/**',
		'node_modules/**',
		'*.d.ts',
		'.cache/**',
	],
};

export default config;
