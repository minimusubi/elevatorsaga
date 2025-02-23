import { getCodeObjFromCode } from '../script/base.js';
import { challenges } from './challenges.js';
import { WorldController, WorldCreator } from './world.js';
import {
	clearAll,
	makeDemoFullscreen,
	presentChallenge,
	presentCodeStatus,
	presentFeedback,
	presentStats,
	presentWorld,
} from './presenters.js';
import { getCodeTemplate, getTemplate } from './util.js';
import Emitter from './emitter.js';

const STORAGE_TIMESCALE_KEY = 'elevatorTimeScale';
const STORAGE_USERCODE_KEY = 'elevatorCrushCode_v5';
const STORAGE_USERCODE_BACKUP_KEY = 'develevateBackupCode';
let params = {};

const createEditor = () => {
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
		localStorage.setItem(STORAGE_USERCODE_KEY, cm.getValue());
		document.querySelector('#save_message').textContent = `Code saved ${new Date().toTimeString()}`;
		returnObj.trigger('change');
	};

	const existingCode = localStorage.getItem(STORAGE_USERCODE_KEY);
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
			localStorage.setItem(STORAGE_USERCODE_BACKUP_KEY, cm.getValue());
			reset();
		}
		cm.focus();
	});

	document.querySelector('#button_resetundo').addEventListener('click', () => {
		if (confirm('Do you want to bring back the code as before the last reset?')) {
			cm.setValue(localStorage.getItem(STORAGE_USERCODE_BACKUP_KEY) || '');
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

const createParamsUrl = function (current, overrides) {
	return `#${_.map(_.merge(current, overrides), (val, key) => {
		return `${key}=${val}`;
	}).join(',')}`;
};

class App extends Emitter {
	worldController = new WorldController(1.0 / 60.0);
	worldCreator = new WorldCreator();
	world = undefined;
	currentChallengeIndex = 0;

	element = {
		innerWorld: document.querySelector('.innerworld'),
		stats: document.querySelector('.statscontainer'),
		feedback: document.querySelector('.feedbackcontainer'),
		challenge: document.querySelector('.challenge'),
	};

	template = {
		floor: getTemplate('floor-template'),
		elevator: getTemplate('elevator-template'),
		elevatorButton: getTemplate('elevatorbutton-template'),
		user: getTemplate('user-template'),
		challenge: getTemplate('challenge-template'),
		feedback: getTemplate('feedback-template'),
	};

	constructor(editor) {
		super();

		this.editor = editor;
		this.worldController.on('usercode_error', (e) => {
			console.log('World raised code error', e);
			editor.trigger('usercode_error', e);
		});
		console.log(this.worldController);
	}

	startStopOrRestart() {
		if (this.world.challengeEnded) {
			this.startChallenge(this.currentChallengeIndex);
		} else {
			this.worldController.setPaused(!this.worldController.isPaused);
		}
	}

	async startChallenge(challengeIndex, autoStart) {
		if (typeof this.world !== 'undefined') {
			this.world.unWind();
			// TODO: Investigate if memory leaks happen here
		}
		this.currentChallengeIndex = challengeIndex;
		this.world = this.worldCreator.createWorld(challenges[challengeIndex].options);
		window.world = this.world;

		clearAll([this.element.innerWorld, this.element.feedback]);
		presentStats(this.element.stats, this.world);
		presentChallenge(
			this.element.challenge,
			challenges[challengeIndex],
			this,
			this.world,
			this.worldController,
			challengeIndex + 1,
			this.template.challenge,
		);
		presentWorld(
			this.element.innerWorld,
			this.world,
			this.template.floor,
			this.template.elevator,
			this.template.elevatorButton,
			this.template.user,
		);

		this.worldController.on('timescale_changed', () => {
			localStorage.setItem(STORAGE_TIMESCALE_KEY, this.worldController.timeScale);
			presentChallenge(
				this.element.challenge,
				challenges[challengeIndex],
				this,
				this.world,
				this.worldController,
				challengeIndex + 1,
				this.template.challenge,
			);
		});

		this.world.on('stats_changed', () => {
			const challengeStatus = challenges[challengeIndex].condition.evaluate(this.world);
			if (challengeStatus !== null) {
				this.world.challengeEnded = true;
				this.worldController.setPaused(true);
				if (challengeStatus) {
					presentFeedback(
						this.element.feedback,
						this.template.feedback,
						this.world,
						'Success!',
						'Challenge completed',
						createParamsUrl(params, { challenge: challengeIndex + 2 }),
					);
				} else {
					presentFeedback(
						this.element.feedback,
						this.template.feedback,
						this.world,
						'Challenge failed',
						'Maybe your program needs an improvement?',
						'',
					);
				}
			}
		});

		const codeObj = await this.editor.getCodeObj();
		console.log('Starting...');
		this.worldController.start(this.world, codeObj, window.requestAnimationFrame, autoStart);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const editor = createEditor();
	const codestatus = document.querySelector('.codestatus');
	const codeStatusTempl = getTemplate('codestatus-template');

	const app = new App(editor);

	editor.on('apply_code', () => {
		app.startChallenge(app.currentChallengeIndex, true);
	});
	editor.on('code_success', () => {
		presentCodeStatus(codestatus, codeStatusTempl);
	});
	editor.on('usercode_error', (error) => {
		presentCodeStatus(codestatus, codeStatusTempl, error);
	});
	editor.on('change', () => {
		document.querySelector('#fitness_message').classList.add('faded');
		// const codeStr = editor.getCode();
		// fitnessSuite(codeStr, true, function (results) {
		// 	var message = '';
		// 	if (!results.error) {
		// 		message =
		// 			'Fitness avg wait times: ' +
		// 			_.map(results, function (r) {
		// 				return r.options.description + ': ' + r.result.avgWaitTime.toPrecision(3) + 's';
		// 			}).join('&nbsp&nbsp&nbsp');
		// 	} else {
		// 		message = 'Could not compute fitness due to error: ' + results.error;
		// 	}
		// 	document.querySelector('#fitness_message').innerHTML = message
		// 	document.querySelector('#fitness_message').classList.remove('faded');
		// });
	});
	editor.trigger('change');

	riot.route((path) => {
		const hash = path.match(/#(.+)/)?.[1] ?? '';
		params = _.reduce(
			hash.split(','),
			(result, p) => {
				const match = p.match(/(\w+)=(\w+$)/);
				if (match) {
					result[match[1]] = match[2];
				}
				return result;
			},
			{},
		);
		let requestedChallenge = 0;
		let autoStart = false;
		let timeScale = parseFloat(localStorage.getItem(STORAGE_TIMESCALE_KEY)) || 2.0;
		_.each(params, (val, key) => {
			if (key === 'challenge') {
				requestedChallenge = _.parseInt(val) - 1;
				if (requestedChallenge < 0 || requestedChallenge >= challenges.length) {
					console.log('Invalid challenge index', requestedChallenge);
					console.log('Defaulting to first challenge');
					requestedChallenge = 0;
				}
			} else if (key === 'autostart') {
				autoStart = val === 'false' ? false : true;
			} else if (key === 'timescale') {
				timeScale = parseFloat(val);
			} else if (key === 'devtest') {
				editor.setDevTestCode();
			} else if (key === 'fullscreen') {
				makeDemoFullscreen();
			}
		});
		app.worldController.setTimeScale(timeScale);
		app.startChallenge(requestedChallenge, autoStart);
	});

	// Trigger route function above
	// Not needed when used in a synchronous context (without ES6+ import/export)
	riot.route(location.pathname + location.hash);
});
