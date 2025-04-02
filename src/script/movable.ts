import Emitter from './emitter.js';

const EPSILON = 0.00001;

const powInterpolate = function (value0: number, value1: number, x: number, a: number) {
	return value0 + ((value1 - value0) * Math.pow(x, a)) / (Math.pow(x, a) + Math.pow(1 - x, a));
};
const coolInterpolate = function (value0: number, value1: number, x: number) {
	return powInterpolate(value0, value1, x, 1.3);
};
const DEFAULT_INTERPOLATOR = coolInterpolate;

const _tmpPosStorage: [number, number] = [0, 0];

type MovableEvents = {
	new_state: [movable: Movable<MovableEvents>];
	new_display_state: [movable: Movable<MovableEvents>];
};

type NonEmittingMovable = Omit<Movable, '#listeners' | 'on' | 'once' | 'off'>;

// export default class Movable<TEvents extends Record<string, unknown[]>> extends Emitter<MovableEvents & TEvents> {
export default class Movable<TEvents extends Record<string, unknown[]> = Record<string, never>> extends Emitter<
	Omit<MovableEvents, keyof TEvents> & TEvents
> {
	x = 0.0;
	y = 0.0;
	parent: NonEmittingMovable | null = null;
	worldX = 0.0;
	worldY = 0.0;
	currentTask: ((deltaTime: number) => void) | null = null;

	constructor() {
		super();

		// @ts-expect-error Typing is hard
		this.trigger('new_state', this);
	}

	static linearInterpolate(this: void, value0: number, value1: number, x: number) {
		return value0 + (value1 - value0) * x;
	}

	updateDisplayPosition(forceTrigger?: boolean) {
		this.getWorldPosition(_tmpPosStorage);
		const oldX = this.worldX;
		const oldY = this.worldY;
		this.worldX = _tmpPosStorage[0];
		this.worldY = _tmpPosStorage[1];
		if (oldX !== this.worldX || oldY !== this.worldY || forceTrigger) {
			// @ts-expect-error Typing is hard
			this.trigger('new_display_state', this);
		}
	}

	moveTo(newX: number | null, newY: number | null) {
		if (newX !== null) {
			this.x = newX;
		}
		if (newY !== null) {
			this.y = newY;
		}

		// @ts-expect-error Typing is hard
		this.trigger('new_state', this);
	}

	moveToFast(newX: number, newY: number) {
		this.x = newX;
		this.y = newY;

		// @ts-expect-error Typing is hard
		this.trigger('new_state', this);
	}

	isBusy() {
		return this.currentTask !== null;
	}

	makeSureNotBusy() {
		if (this.isBusy()) {
			console.error('Attempt to use movable while it was busy', this);
			throw { message: 'Object is busy - you should use callback', obj: this };
		}
	}

	wait(millis: number, callback?: () => void) {
		this.makeSureNotBusy();
		let timeSpent = 0.0;
		const self = this;
		self.currentTask = function waitTask(deltaTime) {
			timeSpent += deltaTime;
			if (timeSpent > millis) {
				self.currentTask = null;

				if (callback) {
					callback();
				}
			}
		};
	}

	moveToOverTime(
		newX: number | null,
		newY: number | null,
		timeToSpend: number,
		interpolator: typeof DEFAULT_INTERPOLATOR = DEFAULT_INTERPOLATOR,
		callback?: () => void,
	) {
		this.makeSureNotBusy();
		if (newX === null) {
			newX = this.x;
		}
		if (newY === null) {
			newY = this.y;
		}
		const origX = this.x;
		const origY = this.y;
		let timeSpent = 0.0;
		const self = this;
		this.currentTask = function moveToOverTimeTask(deltaTime) {
			timeSpent = Math.min(timeToSpend, timeSpent + deltaTime);
			if (timeSpent === timeToSpend) {
				// Epsilon issues possibly?
				self.moveToFast(newX, newY);
				self.currentTask = null;
				if (callback) {
					callback();
				}
			} else {
				const factor = timeSpent / timeToSpend;
				self.moveToFast(interpolator(origX, newX, factor), interpolator(origY, newY, factor));
			}
		};
	}

	update(deltaTime: number) {
		if (this.currentTask !== null) {
			this.currentTask(deltaTime);
		}
	}

	getWorldPosition(storage: [number, number]) {
		let resultX = this.x;
		let resultY = this.y;
		let currentParent = this.parent;
		while (currentParent !== null) {
			resultX += currentParent.x;
			resultY += currentParent.y;
			currentParent = currentParent.parent;
		}
		storage[0] = resultX;
		storage[1] = resultY;
	}

	setParent(movableParent: NonEmittingMovable | null) {
		const objWorld: [number, number] = [0, 0];
		if (movableParent === null) {
			if (this.parent !== null) {
				this.getWorldPosition(objWorld);
				this.parent = null;
				this.moveToFast(objWorld[0], objWorld[1]);
			}
		} else {
			// Parent is being set a non-null movable
			this.getWorldPosition(objWorld);
			const parentWorld: [number, number] = [0, 0];
			movableParent.getWorldPosition(parentWorld);
			this.parent = movableParent;
			this.moveToFast(objWorld[0] - parentWorld[0], objWorld[1] - parentWorld[1]);
		}
	}
}
