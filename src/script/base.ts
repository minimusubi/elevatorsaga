import { ElevatorInterface, FloorInterface } from './interfaces.js';

export const limitNumber = function (num: number, min: number, max: number) {
	return Math.min(max, Math.max(num, min));
};

export const epsilonEquals = function (a: number, b: number) {
	return Math.abs(a - b) < 0.00000001;
};

export const deprecationWarning = function (name: string, replacement?: string) {
	console.warn(`You are using a deprecated feature scheduled for removal: ${name}`);
	if (replacement) {
		console.warn(`Please use ${replacement} instead.`);
	}
};

export const distanceNeededToAchieveSpeed = function (currentSpeed: number, targetSpeed: number, acceleration: number) {
	// v² = u² + 2a * d
	const requiredDistance = (Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / (2 * acceleration);
	return requiredDistance;
};
export const accelerationNeededToAchieveChangeDistance = function (
	currentSpeed: number,
	targetSpeed: number,
	distance: number,
) {
	// v² = u² + 2a * d
	const requiredAcceleration = 0.5 * ((Math.pow(targetSpeed, 2) - Math.pow(currentSpeed, 2)) / distance);
	return requiredAcceleration;
};

type FrameRequesterCallback = (time: number) => void;
export interface FrameRequester {
	currentT: number;
	register: (callback: FrameRequesterCallback) => void;
	trigger: () => void;
}

// Fake frame requester helper used for testing and fitness simulations
export const createFrameRequester = function (timeStep: number) {
	let currentCb: FrameRequesterCallback | null = null;
	const requester: FrameRequester = {
		currentT: 0.0,
		register: function (cb) {
			currentCb = cb;
		},
		trigger: function () {
			requester.currentT += timeStep;
			if (currentCb !== null) {
				currentCb(requester.currentT);
			}
		},
	};
	return requester;
};

export interface UserModule {
	init: (elevators: ElevatorInterface[], floors: FloorInterface[]) => void;
	update: (deltaTime: number, elevators: ElevatorInterface[], floors: FloorInterface[]) => void;
}

export const getModuleFromUserCode = async function (code: string) {
	const moduleURL = URL.createObjectURL(new Blob([code], { type: 'text/javascript; charset=utf-8' }));
	const userModule = (await import(moduleURL)) as Partial<UserModule>;
	URL.revokeObjectURL(moduleURL);

	if (typeof userModule.init !== 'function') {
		throw new Error('Module must export an init function');
	}
	if (typeof userModule.update !== 'function') {
		throw new Error('Module must export an update function');
	}

	return userModule as UserModule;
};

const USER_ERROR_REGEX = /blob:.+:(?<line>\d+):(?<column>\d+)(?=\)(?:\n|$))/g;

export const isUserError = (error: Error) => {
	return USER_ERROR_REGEX.test(error.stack ?? '');
};

export const formatUserErrorStacktrace = (stacktrace: string) => {
	return stacktrace.replaceAll(USER_ERROR_REGEX, 'USER_CODE: Line $<line>, column $<column>');
};
