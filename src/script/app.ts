import './fitness.js';
import { World, WorldController } from './world.js';
import {
	clearAll,
	makeDemoFullscreen,
	presentChallenge,
	presentChallengeSelector,
	presentCodeStatus,
	presentFeedback,
	presentStats,
	presentWorld,
} from './presenters.js';
import { Editor } from './editor.js';
import Emitter from './emitter.js';
import { challenges } from './challenges.js';
import config from './config.js';
import { fitnessSuite } from './fitness.js';
import { getTemplate } from './util.js';
import { isUserError } from './base.js';

let params: Record<string, string> = {};

export function createParamsUrl(overrides: Record<string, string | number | null>) {
	const merged = { ...params, ...overrides };

	return (
		'#' +
		Object.entries(merged)
			.filter(([, value]) => {
				return value !== null;
			})
			.map(([key, value]) => {
				return `${key}=${value}`;
			})
			.join(',')
	);
}

export class App extends Emitter {
	editor: Editor;
	worldController = new WorldController(1.0 / 60.0);
	world?: World = undefined;
	currentChallengeIndex = 0;
	highestChallengeIndex = 0;

	element = {
		innerWorld: document.querySelector<HTMLElement>('.innerworld')!,
		stats: document.querySelector<HTMLElement>('.statscontainer')!,
		feedback: document.querySelector<HTMLElement>('.feedbackcontainer')!,
		challenge: document.querySelector<HTMLElement>('.challenge')!,
	};

	template = {
		floor: getTemplate('floor-template'),
		elevator: getTemplate('elevator-template'),
		elevatorButton: getTemplate('elevatorbutton-template'),
		user: getTemplate('user-template'),
		challenge: getTemplate('challenge-template'),
		feedback: getTemplate('feedback-template'),
	};

	constructor(editor: Editor) {
		super();

		this.editor = editor;
		this.worldController.on('usercode_error', (eventName, error) => {
			console.log('World raised code error', error);
			editor.trigger('usercode_error', error);
		});
		console.log(this.worldController);
	}

	startStopOrRestart() {
		if (this.world?.challengeEnded ?? true) {
			void this.startChallenge(this.currentChallengeIndex);
		} else {
			this.worldController.setPaused(!this.worldController.isPaused);
		}
	}

	async startChallenge(challengeIndex: number, autoStart = false) {
		if (typeof this.world !== 'undefined') {
			this.world.unWind();
			// TODO: Investigate if memory leaks happen here
		}
		this.currentChallengeIndex = challengeIndex;

		if (challengeIndex > this.highestChallengeIndex) {
			this.highestChallengeIndex = challengeIndex;
		}

		this.world = new World(challenges[challengeIndex].options);
		// @ts-expect-error Setting a non-existant property on window
		window.world = this.world;

		clearAll([this.element.innerWorld, this.element.feedback]);
		presentStats(this.element.stats, this.world);
		presentChallengeSelector(challenges, challengeIndex, this.highestChallengeIndex);
		presentChallenge(
			this.element.challenge,
			challenges[challengeIndex],
			challengeIndex + 1,
			this,
			this.world,
			this.worldController,
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
			localStorage.setItem(config.STORAGE_KEY_TIMESCALE, this.worldController.timeScale.toString());
			presentChallenge(
				this.element.challenge,
				challenges[challengeIndex],
				challengeIndex + 1,
				this,
				this.world!,
				this.worldController,
				this.template.challenge,
			);
		});

		this.world.on('stats_changed', () => {
			const challengeStatus = challenges[challengeIndex].condition.evaluate(this.world!);
			if (challengeStatus !== null) {
				this.world!.challengeEnded = true;
				this.worldController.setPaused(true);
				if (challengeStatus) {
					this.highestChallengeIndex = Math.max(this.highestChallengeIndex, challengeIndex + 1);
					presentChallengeSelector(challenges, challengeIndex, this.highestChallengeIndex);
					presentFeedback(
						this.element.feedback,
						this.template.feedback,
						this.world!,
						'Success!',
						'Challenge completed',
						createParamsUrl({ challenge: challengeIndex + 2 }),
					);
				} else {
					presentFeedback(
						this.element.feedback,
						this.template.feedback,
						this.world!,
						'Challenge failed',
						'Maybe your program needs an improvement?',
						'',
					);
				}
			}
		});

		const userModule = await this.editor.getUserModule();

		if (userModule) {
			console.log('Starting...');
			this.worldController.start(this.world, userModule, window.requestAnimationFrame, autoStart);
		}
	}
}

// The async callback returns a promise , but typings expect void
// eslint-disable-next-line @typescript-eslint/no-misused-promises
document.addEventListener('DOMContentLoaded', async () => {
	const editor = await Editor.create();
	const codestatus = document.querySelector<HTMLElement>('.codestatus')!;
	const codeStatusTempl = getTemplate('codestatus-template');

	const app = new App(editor);

	// Handle uncaught promise rejections in user code
	window.addEventListener('unhandledrejection', (event) => {
		if (isUserError(event.reason as Error)) {
			app.worldController.setPaused(true);
			presentCodeStatus(codestatus, codeStatusTempl, event.reason as Error);
		}
	});
	editor.on('apply_code', async () => {
		await app.startChallenge(app.currentChallengeIndex, true);
	});
	editor.on('code_success', () => {
		presentCodeStatus(codestatus, codeStatusTempl);
	});
	editor.on('usercode_error', (eventName, error) => {
		presentCodeStatus(codestatus, codeStatusTempl, error);
	});
	// editor.on('change', async () => {
	// 	document.querySelector('#fitness_message')!.classList.add('faded');
	// 	const codeStr = editor.getContent();
	// 	let message = '';
	// 	try {
	// 		const results = await fitnessSuite(codeStr, true);
	// 		message =
	// 			'Fitness avg wait times: ' +
	// 			results
	// 				.map((result) => {
	// 					return result.options.description + ': ' + result.result.avgWaitTime.toPrecision(3) + 's';
	// 				})
	// 				.join('&nbsp&nbsp&nbsp');
	// 	} catch (error) {
	// 		// eslint-disable-next-line @typescript-eslint/restrict-plus-operands
	// 		message = 'Could not compute fitness due to error: ' + error;
	// 	}
	// 	document.querySelector('#fitness_message')!.innerHTML = message;
	// 	document.querySelector('#fitness_message')!.classList.remove('faded');
	// });
	editor.trigger('change');

	riot.route((path) => {
		const hash = path.match(/#(.+)/)?.[1] ?? '';
		params = hash.split(',').reduce<Record<string, string>>((result, param) => {
			const match = param.match(/(\w+)=(\w+$)/);
			if (match) {
				result[match[1]] = match[2];
			}
			return result;
		}, {});
		let requestedChallenge = 0;
		let autoStart = false;
		let timeScale = parseFloat(localStorage.getItem(config.STORAGE_KEY_TIMESCALE) ?? '2.0');
		for (const [key, value] of Object.entries(params)) {
			if (key === 'challenge') {
				requestedChallenge = parseInt(value, 10) - 1;
				if (requestedChallenge < 0 || requestedChallenge >= challenges.length) {
					console.log('Invalid challenge index', requestedChallenge);
					console.log('Defaulting to first challenge');
					requestedChallenge = 0;
				}
			} else if (key === 'autostart') {
				autoStart = value === 'false' ? false : true;
			} else if (key === 'timescale') {
				timeScale = parseFloat(value);
			} else if (key === 'devtest') {
				editor.setDevTestCode();
			} else if (key === 'fullscreen') {
				makeDemoFullscreen();
			}
		}
		app.worldController.setTimeScale(timeScale);
		void app.startChallenge(requestedChallenge, autoStart);
	});

	// Trigger route function above
	// Not needed when used in a synchronous context (without ES6+ import/export)
	riot.route(location.pathname + location.hash);
});
