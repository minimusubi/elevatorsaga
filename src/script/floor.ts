import Elevator from './elevator.js';
import Emitter from './emitter.js';

type ButtonState = '' | 'activated';

interface ButtonStates {
	up: ButtonState;
	down: ButtonState;
}

type FloorEvents = {
	buttonstate_change: [states: ButtonStates];
	up_button_pressed: [floor: Floor];
	down_button_pressed: [floor: Floor];
};

export default class Floor extends Emitter<FloorEvents> {
	level: number;
	yPosition: number;
	errorHandler: (error: any) => void;
	buttonStates: ButtonStates = { up: '', down: '' };

	constructor(floorLevel: number, yPosition: number, errorHandler: (error: any) => void) {
		super();

		this.level = floorLevel;
		this.yPosition = yPosition;
		this.errorHandler = errorHandler;
	}

	tryTrigger(event: keyof FloorEvents, ...args: FloorEvents[keyof FloorEvents]) {
		try {
			this.trigger(event, ...args);
		} catch (e) {
			this.errorHandler(e);
		}
	}

	pressUpButton() {
		const prev = this.buttonStates.up;
		this.buttonStates.up = 'activated';
		if (prev !== this.buttonStates.up) {
			this.tryTrigger('buttonstate_change', this.buttonStates);
			this.tryTrigger('up_button_pressed', this);
		}
	}

	pressDownButton() {
		const prev = this.buttonStates.down;
		this.buttonStates.down = 'activated';
		if (prev !== this.buttonStates.down) {
			this.tryTrigger('buttonstate_change', this.buttonStates);
			this.tryTrigger('down_button_pressed', this);
		}
	}

	elevatorAvailable(elevator: Elevator) {
		if (elevator.goingUpIndicator && this.buttonStates.up) {
			this.buttonStates.up = '';
			this.tryTrigger('buttonstate_change', this.buttonStates);
		}
		if (elevator.goingDownIndicator && this.buttonStates.down) {
			this.buttonStates.down = '';
			this.tryTrigger('buttonstate_change', this.buttonStates);
		}
	}

	getSpawnPosY() {
		return this.yPosition + 30;
	}

	floorNum() {
		return this.level;
	}
}
