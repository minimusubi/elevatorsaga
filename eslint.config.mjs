import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	js.configs.recommended,
	tseslint.configs.strictTypeChecked,
	eslintConfigPrettier,

	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',

			parserOptions: {
				ecmaFeatures: { impliedStrict: true },

				projectService: { allowDefaultProject: ['eslint.config.mjs'] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'sort-imports': ['warn'],
			'@typescript-eslint/only-throw-error': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-this-alias': 'off',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/restrict-template-expressions': ['error', { allowBoolean: true, allowNumber: true }],
		},
	},
	{ files: ['*'], languageOptions: { globals: globals.node } },
	{ files: ['src/**'], languageOptions: { globals: { ...globals.browser, _: true, riot: true } } },
	{ files: ['src/script/worker/**'], languageOptions: { globals: globals.worker } },
	{ files: ['src/test/**'], languageOptions: { globals: globals.jasmine } },
);
