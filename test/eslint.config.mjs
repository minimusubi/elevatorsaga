import root from '../eslint.config.mjs';

export default [
	...root,
	{
		languageOptions: {
			globals: {
				beforeEach: 'readonly',
				describe: 'readonly',
				expect: 'readonly',
				it: 'readonly',
				jasmine: 'readonly',
				spyOn: 'readonly',
			},
		},
	},
];
