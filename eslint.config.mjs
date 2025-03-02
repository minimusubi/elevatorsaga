import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const languageOptions = {
	ecmaVersion: 'latest',
	sourceType: 'module',

	parserOptions: { ecmaFeatures: { impliedStrict: true } },
};

export default tseslint.config(
	js.configs.recommended,
	tseslint.configs.recommended,
	eslintConfigPrettier,

	{ languageOptions, rules: { 'no-unused-vars': 'warn', 'sort-imports': ['warn'] } },
	{ files: ['*'], languageOptions: { globals: { ...globals.node } } },
	{ files: ['src/**'], languageOptions: { globals: { ...globals.browser, _: true, CodeMirror: true, riot: true } } },
	{ files: ['src/script/worker/**'], languageOptions: { globals: { ...globals.worker } } },
	{ files: ['src/test/**'], languageOptions: { globals: { ...globals.jasmine } } },
);
