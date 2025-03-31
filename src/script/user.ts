import Elevator, { ElevatorEvents } from './elevator.js';
import { EventCallback } from './emitter.js';
import Floor from './floor.js';
import Movable from './movable.js';

type UserEvents = {
	entered_elevator: [elevator: Elevator];
	exited_elevator: [elevator: Elevator];
	removed: [];
	new_state: [];
	new_display_state: [];
};

export default class User extends Movable<UserEvents> {
	weight: number;
	displayType: string;
	currentFloor = 0;
	destinationFloor = 0;
	done = false;
	removeMe = false;
	exitAvailableHandler?: EventCallback<Elevator, ElevatorEvents, 'exit_available'>;
	spawnTimestamp?: number;

	constructor(weight: number, displayType: string) {
		super();

		this.weight = weight;
		this.displayType = displayType;
	}

	appearOnFloor(floor: Floor, destinationFloorNum: number) {
		const floorPosY = floor.getSpawnPosY();
		this.currentFloor = floor.level;
		this.destinationFloor = destinationFloorNum;
		this.moveTo(null, floorPosY);
		this.pressFloorButton(floor);
	}

	pressFloorButton(floor: Floor) {
		if (this.destinationFloor < this.currentFloor) {
			floor.pressDownButton();
		} else {
			floor.pressUpButton();
		}
	}

	handleExit(floorNum: number, elevator: Elevator) {
		if (elevator.currentFloor === this.destinationFloor) {
			elevator.userExiting(this);
			this.currentFloor = elevator.currentFloor;
			this.setParent(null);
			const destination = this.x + 100;
			this.done = true;
			this.trigger('exited_elevator', elevator);
			this.trigger('new_state');
			this.trigger('new_display_state');
			this.moveToOverTime(destination, null, 1 + Math.random() * 0.5, Movable.linearInterpolate, () => {
				this.removeMe = true;
				this.trigger('removed');
				this.off('*');
			});

			elevator.off('exit_available', this.exitAvailableHandler);
		}
	}

	elevatorAvailable(elevator: Elevator, floor: Floor) {
		if (this.done || this.parent !== null || this.isBusy()) {
			return;
		}

		if (!elevator.isSuitableForTravelBetween(this.currentFloor, this.destinationFloor)) {
			// Not suitable for travel - don't use this elevator
			return;
		}

		const pos = elevator.userEntering(this);
		if (pos) {
			// Success
			// @ts-expect-error Elevator will never satisfy Movable because of the generic
			this.setParent(elevator);
			this.trigger('entered_elevator', elevator);
			const self = this;
			this.moveToOverTime(pos[0], pos[1], 1, undefined, () => {
				elevator.pressFloorButton(self.destinationFloor);
			});
			this.exitAvailableHandler = function (event, floorNum: number, elevator: Elevator) {
				self.handleExit(elevator.currentFloor, elevator);
			};
			elevator.on('exit_available', this.exitAvailableHandler);
		} else {
			this.pressFloorButton(floor);
		}
	}
}
