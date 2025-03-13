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
	autoFormat = true;

	static async create() {
		// @ts-expect-error Something is wrong with my typings
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		const monaco = (await loader.init()) as loader.Monaco;
		const monacoEditor = monaco.editor.create(document.getElementById('code')!, {
			language: 'javascript',
			insertSpaces: false,
			scrollBeyondLastLine: false,
		});
		const editor = new Editor(monacoEditor);

		// Add Ctrl/Cmd + S save
		monacoEditor.addAction({
			id: 'save-code',
			label: 'Save Code',
			keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
			run: () => {
				void editor.save();
			},
		});

		return editor;
	}

	/**
	 * Do not explicity construct new instances of this class. Use Editor.create() instead.
	 */
	constructor(editor: monaco.editor.IStandaloneCodeEditor) {
		super();

		this.editor = editor;

		const reset = () => {
			this.setContent(getCodeTemplate('default-elev-implementation'));
		};

		const autoSave = _.debounce(() => {
			void this.save(true);
		}, 1000);
		this.editor.onDidChangeModelContent(() => {
			autoSave();
		});

		const existingCode = localStorage.getItem(config.STORAGE_KEY_USERCODE);
		if (existingCode) {
			this.setContent(existingCode);
		} else {
			reset();
		}

		const saveButton = document.querySelector('#button_save')!;
		const metaSpan = saveButton.querySelector<HTMLSpanElement>('[data-meta]')!;
		metaSpan.innerText = metaSpan.innerText.replace(
			'Meta',
			// There isn't really a good way to do this other than to use navigator.platform
			// eslint-disable-next-line @typescript-eslint/no-deprecated
			navigator.platform.startsWith('Mac') || navigator.platform === 'iPhone' ? '⌘' : 'Ctrl',
		);
		// The async callback returns a promise , but typings expect void
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		saveButton.addEventListener('click', async () => {
			await this.save();
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
		document.querySelector('#button_format')!.addEventListener('click', this.format.bind(this));

		this.autoFormat = !!JSON.parse(localStorage.getItem(config.STORAGE_KEY_FORMAT_ON_SAVE) ?? 'true');

		const formatOnSaveInput = document.querySelector<HTMLInputElement>('#format_on_save')!;
		formatOnSaveInput.checked = this.autoFormat;
		formatOnSaveInput.addEventListener('change', (event: Event) => {
			this.autoFormat = (event.target as HTMLInputElement).checked;
			localStorage.setItem(config.STORAGE_KEY_FORMAT_ON_SAVE, JSON.stringify(this.autoFormat));
		});

		document.querySelector('#button_apply')!.addEventListener('click', () => {
			this.trigger('apply_code');
		});
	}

	async format() {
		const selection = this.editor.getSelection();
		const content = await format(this.getContent());
		this.setContent(content);
		this.editor.focus();

		// Restore selection after focus
		if (selection) {
			this.editor.setSelection(selection);
		}
	}

	async save(isAutoSave: boolean = false) {
		if (!isAutoSave && this.autoFormat) {
			await this.format();
		}

		localStorage.setItem(config.STORAGE_KEY_USERCODE, this.getContent());
		document.querySelector('#save_message')!.textContent = `Code saved ${new Date().toLocaleTimeString()}`;
		this.trigger('change');
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
