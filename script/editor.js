import config from './config.js';
import { getCodeObjFromCode } from '../script/base.js';
import { getCodeTemplate } from './util.js';

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

	// reindent on paste (adapted from https://github.com/ahuth/brackets-paste-and-indent/blob/master/main.js)
	cm.on('change', (codeMirror, change) => {
		if (change.origin !== 'paste') {
			return;
		}

		const lineFrom = change.from.line;
		const lineTo = change.from.line + change.text.length;

		function reindentLines() {
			codeMirror.operation(() => {
				codeMirror.eachLine(lineFrom, lineTo, (lineHandle) => {
					codeMirror.indentLine(lineHandle.lineNo(), 'smart');
				});
			});
		}

		reindentLines();
	});

	const reset = function () {
		cm.setValue(getCodeTemplate('default-elev-implementation'));
	};
	const saveCode = function () {
		localStorage.setItem(config.STORAGE_KEY_USERCODE, cm.getValue());
		document.querySelector('#save_message').textContent = `Code saved ${new Date().toTimeString()}`;
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

	const returnObj = new riot.observable();
	const autoSaver = _.debounce(saveCode, 1000);
	cm.on('change', () => {
		autoSaver();
	});

	returnObj.getCodeObj = async function () {
		console.log('Getting code...');
		const code = cm.getValue();
		let obj;
		try {
			obj = await getCodeObjFromCode(code);
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
