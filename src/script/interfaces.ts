import * as _ from 'https://unpkg.com/radashi@12.4.0/dist/radashi.js';
import Emitter, { EventCallback } from './emitter.js';
import { deprecationWarning, epsilonEquals, limitNumber } from './base.js';
import Elevator from './elevator.js';
import Floor from './floor.js';

// Interface that hides actual elevator object behind a more robust facade,
// while also exposing relevant events, and providing some helper queue
// functions that allow programming without async logic.

type ElevatorInterfaceEvents = {
	idle: [];
	willPassFloor: ElevatorInterfaceEvents['passing_floor'];
	arrive: ElevatorInterfaceEvents['stopped_at_floor'];
	call: ElevatorInterfaceEvents['floor_button_pressed'];

	// Deprecated
	passing_floor: [floor: number, direction: 'up' | 'down'];
	stopped_at_floor: [floor: number];
	floor_button_pressed: [floor: number];
};

export class ElevatorInterface extends Emitter<ElevatorInterfaceEvents> {
	#elevator: Elevator;
	#floorCount: number;
	#errorHandler: (error: any) => void;
	destinationQueue: number[];

	constructor(elevator: Elevator, floorCount: number, errorHandler: (error: any) => void) {
		super();

		this.#elevator = elevator;
		this.#floorCount = floorCount;
		this.#errorHandler = errorHandler;
		this.destinationQueue = [];

		elevator.on('stopped', (eventName, position) => {
			if (this.destinationQueue.length && epsilonEquals(_.first(this.destinationQueue), position)) {
				// Reached the destination, so remove element at front of queue
				this.destinationQueue.shift();
				if (elevator.isOnAFloor()) {
					elevator.wait(1, () => {
						this.checkDestinationQueue();
					});
				} else {
					this.checkDestinationQueue();
				}
			}
		});

		elevator.on('passing_floor', (eventName, floorNum, direction) => {
			this.#tryTrigger('passing_floor', floorNum, direction);
			this.#tryTrigger('willPassFloor', floorNum, direction);
		});

		elevator.on('stopped_at_floor', (eventName, floorNum) => {
			this.#tryTrigger('stopped_at_floor', floorNum);
			this.#tryTrigger('arrive', floorNum);
		});
		elevator.on('floor_button_pressed', (eventName, floorNum) => {
			this.#tryTrigger('floor_button_pressed', floorNum);
			this.#tryTrigger('call', floorNum);
		});
	}

	#tryTrigger(event: keyof ElevatorInterfaceEvents, ...args: ElevatorInterfaceEvents[keyof ElevatorInterfaceEvents]) {
		try {
			this.trigger(event, ...args);
		} catch (e) {
			this.#errorHandler(e);
		}
	}

	checkDestinationQueue() {
		if (!this.#elevator.isBusy()) {
			if (this.destinationQueue.length) {
				this.#elevator.goToFloor(_.first(this.destinationQueue));
			} else {
				this.#tryTrigger('idle');
			}
		}
	}

	// TODO: Write tests for this queueing logic
	goToFloor(floorNum: number, forceNow: boolean = false) {
		floorNum = limitNumber(Number(floorNum), 0, this.#floorCount - 1);
		// Auto-prevent immediately duplicate destinations
		if (this.destinationQueue.length) {
			const adjacentElement = (forceNow ? _.first(this.destinationQueue) : _.last(this.destinationQueue))!;
			if (epsilonEquals(floorNum, adjacentElement)) {
				return;
			}
		}
		this.destinationQueue[forceNow ? 'unshift' : 'push'](floorNum);
		this.checkDestinationQueue();
	}

	stop() {
		this.destinationQueue = [];
		if (!this.#elevator.isBusy()) {
			this.#elevator.goToFloor(this.#elevator.getExactFutureFloorIfStopped());
		}
	}

	/**
	 * @deprecated Undocumented and deprecated, will be removed
	 */
	getFirstPressedFloor() {
		return this.#elevator.getFirstPressedFloor();
	}
	/**
	 * @deprecated Use calls instead.
	 */
	getPressedFloors() {
		deprecationWarning('getPressedFloors()', 'calls');
		return this.#elevator.getPressedFloors();
	}
	get calls() {
		return this.#elevator.getPressedFloors();
	}
	currentFloor() {
		return this.#elevator.currentFloor;
	}
	maxPassengerCount() {
		return this.#elevator.maxUsers;
	}
	loadFactor() {
		return this.#elevator.getLoadFactor();
	}
	destinationDirection() {
		if (this.#elevator.destinationY === this.#elevator.y) {
			return 'stopped';
		}
		return this.#elevator.destinationY > this.#elevator.y ? 'down' : 'up';
	}

	goingUpIndicator(): boolean;
	goingUpIndicator(value: boolean): this;
	goingUpIndicator(value?: boolean) {
		if (value !== undefined) {
			this.#elevator.goingUpIndicator = value ? true : false;
			this.#elevator.trigger('change:goingUpIndicator', this.#elevator.goingUpIndicator);
			return this;
		} else {
			return this.#elevator.goingUpIndicator;
		}
	}

	goingDownIndicator(): boolean;
	goingDownIndicator(value: boolean): this;
	goingDownIndicator(value?: boolean) {
		if (value !== undefined) {
			this.#elevator.goingDownIndicator = value ? true : false;
			this.#elevator.trigger('change:goingDownIndicator', this.#elevator.goingDownIndicator);
			return this;
		} else {
			return this.#elevator.goingDownIndicator;
		}
	}

	#warnDeprecatedEvent(event: Extract<keyof ElevatorInterfaceEvents, string>) {
		if (event === 'passing_floor') {
			deprecationWarning(event, 'willPassFloor');
		} else if (event === 'stopped_at_floor') {
			deprecationWarning(event, 'arrive');
		} else if (event === 'floor_button_pressed') {
			deprecationWarning(event, 'call');
		}
	}

	on<TEventName extends Extract<keyof ElevatorInterfaceEvents, string>>(
		eventName: TEventName,
		callback: EventCallback<ElevatorInterfaceEvents, TEventName>,
	) {
		this.#warnDeprecatedEvent(eventName);
		super.on(eventName, callback);
	}

	once<TEventName extends Extract<keyof ElevatorInterfaceEvents, string>>(
		eventName: TEventName,
		callback: EventCallback<ElevatorInterfaceEvents, TEventName>,
	) {
		this.#warnDeprecatedEvent(eventName);
		super.once(eventName, callback);
	}
}

type FloorInterfaceEvents = {
	call: [direction: 'up' | 'down', floor: FloorInterface];

	// Deprecated
	up_button_pressed: [floor: Floor];
	down_button_pressed: [floor: Floor];
};

// TODO: Write tests
export class FloorInterface extends Emitter<FloorInterfaceEvents> {
	#floor: Floor;
	#errorHandler: (error: any) => void;

	constructor(floor: Floor, errorHandler: (error: any) => void) {
		super();

		this.#floor = floor;
		this.#errorHandler = errorHandler;

		floor.on('up_button_pressed', (eventName, ...args) => {
			this.#tryTrigger('up_button_pressed', ...args);
			this.#tryTrigger('call', 'up', this);
		});
		floor.on('down_button_pressed', (eventName, ...args) => {
			this.#tryTrigger('down_button_pressed', ...args);
			this.#tryTrigger('call', 'down', this);
		});
	}

	#tryTrigger(event: keyof FloorInterfaceEvents, ...args: FloorInterfaceEvents[keyof FloorInterfaceEvents]) {
		try {
			this.trigger(event, ...args);
		} catch (e) {
			this.#errorHandler(e);
		}
	}

	/**
	 * @deprecated Use number instead.
	 */
	floorNum() {
		deprecationWarning('floorNum()', 'number');
		return this.#floor.floorNum();
	}

	get number() {
		return this.#floor.level;
	}

	#warnDeprecatedEvent(event: Extract<keyof FloorInterfaceEvents, string>) {
		if (event === 'up_button_pressed') {
			deprecationWarning(event, 'call');
		} else if (event === 'down_button_pressed') {
			deprecationWarning(event, 'call');
		}
	}

	on<TEventName extends Extract<keyof FloorInterfaceEvents, string>>(
		eventName: TEventName,
		callback: EventCallback<FloorInterfaceEvents, TEventName>,
	) {
		this.#warnDeprecatedEvent(eventName);
		super.on(eventName, callback);
	}

	once<TEventName extends Extract<keyof FloorInterfaceEvents, string>>(
		eventName: TEventName,
		callback: EventCallback<FloorInterfaceEvents, TEventName>,
	) {
		this.#warnDeprecatedEvent(eventName);
		super.once(eventName, callback);
	}
}
