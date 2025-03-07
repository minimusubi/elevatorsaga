import * as prettier from 'https://unpkg.com/prettier@3.5.2/standalone.mjs';
import * as prettierPluginBabel from 'https://unpkg.com/prettier@3.5.2/plugins/babel.mjs';
import * as prettierPluginEstree from 'https://unpkg.com/prettier@3.5.2/plugins/estree.mjs';
import Emitter from './emitter.js';
import config from './config.js';
import { getCodeTemplate } from './util.js';
import { getModuleFromUserCode } from '../script/base.js';

async function format(code) {
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

export const createEditor = () => {
	const cm = CodeMirror.fromTextArea(document.getElementById('code'), {
		lineNumbers: true,
		indentUnit: 4,
		indentWithTabs: false,
		theme: 'solarized light',
		mode: 'javascript',
		autoCloseBrackets: true,
		extraKeys: {
			// the following Tab key mapping is from http://codemirror.net/doc/manual.html#keymaps
			Tab: function (cm) {
				const spaces = new Array(cm.getOption('indentUnit') + 1).join(' ');
				cm.replaceSelection(spaces);
			},
		},
	});

	const reset = function () {
		cm.setValue(getCodeTemplate('default-elev-implementation'));
	};
	const saveCode = function () {
		localStorage.setItem(config.STORAGE_KEY_USERCODE, cm.getValue());
		document.querySelector('#save_message').textContent = `Code saved ${new Date().toLocaleTimeString()}`;
		returnObj.trigger('change');
	};

	const existingCode = localStorage.getItem(config.STORAGE_KEY_USERCODE);
	if (existingCode) {
		cm.setValue(existingCode);
	} else {
		reset();
	}

	document.querySelector('#button_save').addEventListener('click', () => {
		saveCode();
		cm.focus();
	});

	document.querySelector('#button_reset').addEventListener('click', () => {
		if (confirm('Do you really want to reset to the default implementation?')) {
			localStorage.setItem(config.STORAGE_KEY_USERCODE_BACKUP, cm.getValue());
			reset();
		}
		cm.focus();
	});

	document.querySelector('#button_resetundo').addEventListener('click', () => {
		if (confirm('Do you want to bring back the code as before the last reset?')) {
			cm.setValue(localStorage.getItem(config.STORAGE_KEY_USERCODE_BACKUP) || '');
		}
		cm.focus();
	});

	document.querySelector('#button_format').addEventListener('click', async () => {
		cm.setValue((await format(cm.getValue())) || '');
		cm.focus();
	});

	const returnObj = new Emitter();
	const autoSaver = _.debounce(saveCode, 1000);
	cm.on('change', () => {
		autoSaver();
	});

	returnObj.getCodeObj = async function () {
		console.log('Getting code...');
		const code = cm.getValue();
		let obj;
		try {
			obj = await getModuleFromUserCode(code);
			returnObj.trigger('code_success');
		} catch (e) {
			returnObj.trigger('usercode_error', e);
			return null;
		}
		return obj;
	};
	returnObj.setCode = function (code) {
		cm.setValue(code);
	};
	returnObj.getCode = function () {
		return cm.getValue();
	};
	returnObj.setDevTestCode = function () {
		cm.setValue(getCodeTemplate('devtest-elev-implementation'));
	};

	document.querySelector('#button_apply').addEventListener('click', () => {
		returnObj.trigger('apply_code');
	});
	return returnObj;
};
