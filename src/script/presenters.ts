import { App, createParamsUrl } from './app.js';
import { World, WorldController } from './world.js';
import { Challenge } from './challenges.js';
import Elevator from './elevator.js';
import User from './user.js';
import { formatUserErrorStacktrace } from './base.js';

function makeFragment(html: string) {
	const container = document.createElement('template');
	container.innerHTML = html;

	return container.content.cloneNode(true);
}

export function clearAll(elements: HTMLElement[]) {
	for (const element of elements) {
		element.replaceChildren();
	}
}

function setTransformPos(elem: HTMLElement, x: number, y: number) {
	const style = `translate(${x}px,${y}px) translateZ(0)`;
	elem.style.transform = style;
	// @ts-expect-error Vendor-prefixed style
	elem.style['-ms-transform'] = style;
	// @ts-expect-error Vendor-prefixed style
	elem.style['-webkit-transform'] = style;
}

function updateUserState(userElement: HTMLElement, user: User) {
	setTransformPos(userElement, user.worldX, user.worldY);
	if (user.done) {
		userElement.classList.add('leaving');
	}
}

export function presentStats(parent: HTMLElement, world: World) {
	const elem_transportedcounter = parent.querySelector('.transportedcounter')!,
		elem_elapsedtime = parent.querySelector('.elapsedtime')!,
		elem_transportedpersec = parent.querySelector('.transportedpersec')!,
		elem_avgwaittime = parent.querySelector('.avgwaittime')!,
		elem_maxwaittime = parent.querySelector('.maxwaittime')!,
		elem_movecount = parent.querySelector('.movecount')!;

	world.on('stats_display_changed', () => {
		elem_transportedcounter.textContent = world.transportedCounter.toString();
		elem_elapsedtime.textContent = `${world.elapsedTime.toFixed(0)}s`;
		elem_transportedpersec.textContent = world.transportedPerSec.toPrecision(3);
		elem_avgwaittime.textContent = `${world.avgWaitTime.toFixed(1)}s`;
		elem_maxwaittime.textContent = `${world.maxWaitTime.toFixed(1)}s`;
		elem_movecount.textContent = world.moveCount.toString();
	});
	world.trigger('stats_display_changed');
}

export function presentChallengeSelector(challenges: Challenge[], currentIndex: number, highestIndex: number) {
	const prevButton = document.querySelector('.challenge-navigator .previous') as HTMLAnchorElement;
	const nextButton = document.querySelector('.challenge-navigator .next') as HTMLAnchorElement;
	if (currentIndex === 0) {
		prevButton.removeAttribute('href');
		prevButton.classList.add('disabled');
	} else {
		prevButton.href = createParamsUrl({ challenge: currentIndex });
		prevButton.classList.remove('disabled');
	}
	if (currentIndex === challenges.length - 1 || currentIndex >= highestIndex) {
		nextButton.removeAttribute('href');
		nextButton.classList.add('disabled');
	} else {
		nextButton.href = createParamsUrl({ challenge: currentIndex + 2 });
		nextButton.classList.remove('disabled');
	}

	document.querySelector('.challenge-selector')!.replaceChildren(
		...challenges.map((_, index) => {
			const element = document.createElement('a');
			element.innerText = `${index + 1}`;
			element.href = createParamsUrl({ challenge: index + 1 });
			if (currentIndex === index) {
				element.classList.add('emphasis-color');
			}
			if (index > highestIndex) {
				element.classList.add('disabled');
				element.removeAttribute('href');
				element.addEventListener('click', (event) => {
					event.preventDefault();
				});
			}

			return element;
		}),
	);
}

export function presentChallenge(
	parent: HTMLElement,
	challenge: Challenge,
	challengeNum: number,
	app: App,
	world: World,
	worldController: WorldController,
	challengeTempl: string,
) {
	parent.innerHTML = riot.render(challengeTempl, {
		challenge,
		num: challengeNum,
		timeScale: `${worldController.timeScale.toFixed(0)}x`,
		startButtonText: world.challengeEnded ? 'Restart' : worldController.isPaused ? 'Start' : 'Pause',
		startButtonIcon: world.challengeEnded ? 'replay' : worldController.isPaused ? 'play_arrow' : 'pause',
	});

	parent.querySelector('.startstop')!.addEventListener('click', () => {
		app.startStopOrRestart();
	});
	parent.querySelector('.timescale_increase')!.addEventListener('click', (e) => {
		e.preventDefault();
		if (worldController.timeScale < 40) {
			const timeScale = Math.round(worldController.timeScale * 1.618);
			worldController.setTimeScale(timeScale);
		}
	});
	parent.querySelector('.timescale_decrease')!.addEventListener('click', (e) => {
		e.preventDefault();
		const timeScale = Math.round(worldController.timeScale / 1.618);
		worldController.setTimeScale(timeScale);
	});
}

export function presentFeedback(
	parent: HTMLElement,
	feedbackTempl: string,
	world: World,
	title: string,
	message: string,
	url: string,
) {
	parent.innerHTML = riot.render(feedbackTempl, {
		title: title,
		message: message,
		url: url,
		paddingTop: world.floors.length * world.floorHeight * 0.2,
	});
	if (!url) {
		parent.querySelector('a')!.remove();
	}
}

export function presentWorld(
	worldElement: HTMLElement,
	world: World,
	floorTempl: string,
	elevatorTempl: string,
	elevatorButtonTempl: string,
	userTempl: string,
) {
	worldElement.style.height = `${world.floorHeight * world.floors.length}px`;

	for (const floor of world.floors) {
		const floorFragment = makeFragment(riot.render(floorTempl, floor)) as HTMLElement;
		const up = floorFragment.querySelector('.up')!;
		const down = floorFragment.querySelector('.down')!;
		floor.on('buttonstate_change', (event, buttonStates) => {
			up.classList.toggle('activated', buttonStates.up !== '');
			down.classList.toggle('activated', buttonStates.down !== '');
		});
		up.addEventListener('click', () => {
			floor.pressUpButton();
		});
		down.addEventListener('click', () => {
			floor.pressDownButton();
		});
		worldElement.appendChild(floorFragment);
	}

	worldElement.querySelector('.floor:first-of-type .down')!.classList.add('invisible');
	worldElement.querySelector('.floor:last-of-type .up')!.classList.add('invisible');

	function renderElevatorButtons(states: boolean[]) {
		// This is a rarely executed inner-inner loop, does not need efficiency
		return states
			.map((value, i) => {
				return riot.render(elevatorButtonTempl, { floorNum: i });
			})
			.join('');
	}

	function setUpElevator(elevator: Elevator) {
		const elevatorElement = makeFragment(riot.render(elevatorTempl, { e: elevator })).firstChild as HTMLElement;
		elevatorElement.querySelector('.buttonindicator')!.innerHTML = renderElevatorButtons(elevator.buttonStates);
		const buttons = elevatorElement.querySelector('.buttonindicator')!.children;
		const elem_floorindicator = elevatorElement.querySelector('.floorindicator > span')!;

		elevatorElement.addEventListener('click', (event) => {
			if (!(event.target as HTMLElement).classList.contains('buttonpress')) {
				return;
			}

			elevator.pressFloorButton(parseInt((event.target as HTMLElement).textContent!));
		});
		elevator.on('new_display_state', () => {
			setTransformPos(elevatorElement, elevator.worldX, elevator.worldY);
		});
		elevator.on('new_current_floor', (event, floor) => {
			elem_floorindicator.textContent = `${floor}`;
		});
		elevator.on('floor_buttons_changed', (event, states, indexChanged) => {
			buttons[indexChanged].classList.toggle('activated', states[indexChanged]);
		});
		elevator.on('indicatorstate_change', (event, indicatorStates) => {
			elevatorElement.querySelector('.up')!.classList.toggle('activated', indicatorStates.up);
			elevatorElement.querySelector('.down')!.classList.toggle('activated', indicatorStates.down);
		});
		elevator.trigger('new_state', elevator);
		elevator.trigger('new_display_state', elevator);
		elevator.trigger('new_current_floor', elevator.currentFloor);
		return elevatorElement;
	}

	for (const elevator of world.elevators) {
		worldElement.appendChild(setUpElevator(elevator));
	}

	world.on('new_user', (event, user) => {
		const userElement = makeFragment(riot.render(userTempl, { u: user, state: user.done ? 'leaving' : '' }))
			.firstChild as HTMLElement;

		user.on('new_display_state', () => {
			updateUserState(userElement, user);
		});
		user.on('removed', () => {
			userElement.remove();
		});
		worldElement.append(userElement);
	});
}

export function presentCodeStatus(parent: HTMLElement, templ: string, error?: unknown) {
	console.log(error);
	const errorDisplay = error ? 'block' : 'none';
	const successDisplay = error ? 'none' : 'block';
	let errorMessage = error?.toString() ?? '';
	if (typeof error === 'object' && error instanceof Error) {
		errorMessage = error.stack ?? '';
		errorMessage = formatUserErrorStacktrace(errorMessage);
		errorMessage = errorMessage.replace(/\n/g, '<br>');
	}

	const status = riot.render(templ, {
		errorMessage: errorMessage,
		errorDisplay: errorDisplay,
		successDisplay: successDisplay,
	});
	parent.innerHTML = status;
}

export function makeDemoFullscreen() {
	for (const element of document.querySelectorAll<HTMLElement>('body .container > *:not(.world)')) {
		element.style.visibility = 'hidden';
	}

	for (const element of document.querySelectorAll<HTMLElement>('html, body, body .container, .world')) {
		element.style.width = '100%';
		element.style.margin = '0';
		element.style.padding = '0';
	}
}
