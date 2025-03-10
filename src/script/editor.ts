import type * as monaco from 'monaco-editor';
import * as prettier from 'https://unpkg.com/prettier@3.5.2/standalone.mjs';
import * as prettierPluginBabel from 'https://unpkg.com/prettier@3.5.2/plugins/babel.mjs';
import * as prettierPluginEstree from 'https://unpkg.com/prettier@3.5.2/plugins/estree.mjs';
import Emitter from './emitter.js';
import config from './config.js';
import { getCodeTemplate } from './util.js';
import { getModuleFromUserCode } from '../script/base.js';
import loader from 'https://esm.sh/@monaco-editor/loader@1.5.0';

async function format(code: string) {
	return await prettier.format(code, {
		parser: 'babel',
		plugins: [prettierPluginEstree, prettierPluginBabel],

		arrowParens: 'always',
		bracketSameLine: false,
		objectWrap: 'collapse',
		bracketSpacing: true,
		semi: true,
		experimentalOperatorPosition: 'end',
		experimentalTernaries: false,
		singleQuote: true,
		jsxSingleQuote: true,
		quoteProps: 'as-needed',
		trailingComma: 'all',
		singleAttributePerLine: false,
		htmlWhitespaceSensitivity: 'css',
		vueIndentScriptAndStyle: true,
		proseWrap: 'preserve',
		insertPragma: false,
		printWidth: 80,
		requirePragma: false,
		tabWidth: 4,
		useTabs: true,
		embeddedLanguageFormatting: 'auto',
	});
}

type EditorEvents = { apply_code: []; code_success: []; usercode_error: [error: unknown]; change: [] };

export class Editor extends Emitter<EditorEvents> {
	editor: monaco.editor.IStandaloneCodeEditor;

	static async create() {
		// @ts-expect-error Something is wrong with my typings
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		const monaco = (await loader.init()) as loader.Monaco;
		const editor = monaco.editor.create(document.getElementById('code')!, {
			language: 'javascript',
			insertSpaces: false,
		});

		return new Editor(editor);
	}

	/**
	 * Do not explicity construct new instances of this class. Use Editor.create() instead.
	 */
	constructor(editor: monaco.editor.IStandaloneCodeEditor) {
		super();

		this.editor = editor;

		const saveCode = () => {
			localStorage.setItem(config.STORAGE_KEY_USERCODE, this.getContent());
			document.querySelector('#save_message')!.textContent = `Code saved ${new Date().toLocaleTimeString()}`;
			this.trigger('change');
		};
		const reset = () => {
			this.setContent(getCodeTemplate('default-elev-implementation'));
		};

		const autoSaver = _.debounce(saveCode, 1000);
		this.editor.onDidChangeModelContent(() => {
			autoSaver();
		});

		const existingCode = localStorage.getItem(config.STORAGE_KEY_USERCODE);
		if (existingCode) {
			this.setContent(existingCode);
		} else {
			reset();
		}

		document.querySelector('#button_save')!.addEventListener('click', () => {
			saveCode();
			this.editor.focus();
		});

		document.querySelector('#button_reset')!.addEventListener('click', () => {
			if (confirm('Do you really want to reset to the default implementation?')) {
				localStorage.setItem(config.STORAGE_KEY_USERCODE_BACKUP, this.getContent());
				reset();
			}
			this.editor.focus();
		});

		document.querySelector('#button_resetundo')!.addEventListener('click', () => {
			if (confirm('Do you want to bring back the code as before the last reset?')) {
				this.setContent(localStorage.getItem(config.STORAGE_KEY_USERCODE_BACKUP) || '');
			}
			this.editor.focus();
		});

		// The async callback returns a promise , but typings expect void
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		document.querySelector('#button_format')!.addEventListener('click', async () => {
			const content = await format(this.getContent());
			this.setContent(content || '');
			this.editor.focus();
		});

		document.querySelector('#button_apply')!.addEventListener('click', () => {
			this.trigger('apply_code');
		});
	}

	async getUserModule() {
		console.log('Getting code...');
		const code = this.getContent();

		try {
			const module = await getModuleFromUserCode(code);
			this.trigger('code_success');

			return module;
		} catch (e) {
			this.trigger('usercode_error', e);
			return null;
		}
	}

	setContent(code: string) {
		console.log('setting code', code);
		this.editor.setValue(code);
	}

	getContent() {
		return this.editor.getValue();
	}

	setDevTestCode() {
		this.setContent(getCodeTemplate('devtest-elev-implementation'));
	}
}
