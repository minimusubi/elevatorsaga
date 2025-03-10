import { epsilonEquals, limitNumber } from './base.js';
import Elevator from './elevator.js';
import Emitter from './emitter.js';

// Interface that hides actual elevator object behind a more robust facade,
// while also exposing relevant events, and providing some helper queue
// functions that allow programming without async logic.

type ElevatorInterfaceEvents = {
	idle: [];
	passing_floor: [floor: number, direction: 'up' | 'down'];
	stopped_at_floor: [floor: number];
	floor_button_pressed: [floor: number];
};

export default class ElevatorInterface extends Emitter<ElevatorInterfaceEvents> {
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
				this.destinationQueue = _.rest(this.destinationQueue);
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
		});

		elevator.on('stopped_at_floor', (eventName, floorNum) => {
			this.#tryTrigger('stopped_at_floor', floorNum);
		});
		elevator.on('floor_button_pressed', (eventName, floorNum) => {
			this.#tryTrigger('floor_button_pressed', floorNum);
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
			const adjacentElement = forceNow ? _.first(this.destinationQueue) : _.last(this.destinationQueue);
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

	getFirstPressedFloor() {
		return this.#elevator.getFirstPressedFloor();
	} // Undocumented and deprecated, will be removed
	getPressedFloors() {
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
}
