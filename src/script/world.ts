import Elevator from './elevator.js';
import ElevatorInterface from './interfaces.js';
import Emitter from './emitter.js';
import Floor from './floor.js';
import User from './user.js';
import config from './config.js';
import { UserModule } from './base.js';

export interface WorldOptions {
	floorHeight: number;
	floorCount: number;
	elevators: { capacity: number }[];
	spawnRate: number;
}

type WorldEvents = {
	new_user: [user: User];
	stats_changed: [];
	stats_display_changed: [];
	usercode_error: [error: unknown];
};

export class World extends Emitter<WorldEvents> {
	floorHeight: number;
	floors: Floor[];
	elevators: Elevator[];
	elevatorInterfaces: ElevatorInterface[];
	spawnRate;
	users: User[] = [];
	transportedCounter = 0;
	transportedPerSec = 0.0;
	moveCount = 0;
	elapsedTime = 0.0;
	elapsedSinceSpawn;
	elapsedSinceStatsUpdate = 0.0;
	maxWaitTime = 0.0;
	avgWaitTime = 0.0;
	challengeEnded = false;

	static createFloors(floorCount: number, floorHeight: number, errorHandler: (error: any) => void) {
		const floors = _.map(_.range(floorCount), (e, i) => {
			const yPos = (floorCount - 1 - i) * floorHeight;
			const floor = new Floor(i, yPos, errorHandler);
			return floor;
		});
		return floors;
	}

	static createElevators(elevatorConfig: { capacity: number }[], floorCount: number, floorHeight: number) {
		let currentX = 200.0;

		return elevatorConfig.map(({ capacity }) => {
			const elevator = new Elevator(2.6, floorCount, floorHeight, capacity);

			// Move to right x position
			elevator.moveTo(currentX, null);
			elevator.setFloorPosition(0);
			elevator.updateDisplayPosition();
			currentX += 20 + elevator.width;
			return elevator;
		});
	}

	static createRandomUser() {
		const weight = _.random(55, 100);
		let type;
		if (_.random(40) === 0) {
			type = 'child';
		} else if (_.random(1) === 0) {
			type = 'female';
		} else {
			type = 'male';
		}
		const user = new User(weight, type);

		return user;
	}

	static spawnUserRandomly(floors: Floor[]) {
		const user = World.createRandomUser();
		user.moveTo(105 + _.random(40), 0);
		const currentFloor = _.random(1) === 0 ? 0 : _.random(floors.length - 1);
		let destinationFloor;
		if (currentFloor === 0) {
			// Definitely going up
			destinationFloor = _.random(1, floors.length - 1);
		} else {
			// Usually going down, but sometimes not
			if (_.random(10) === 0) {
				destinationFloor = (currentFloor + _.random(1, floors.length - 1)) % floors.length;
			} else {
				destinationFloor = 0;
			}
		}
		user.appearOnFloor(floors[currentFloor], destinationFloor);
		return user;
	}

	constructor(options: Partial<WorldOptions>) {
		super();

		console.log('Creating world with options', options);
		const defaultOptions = {
			floorHeight: 50,
			floorCount: 4,
			elevators: [{ capacity: 4 }, { capacity: 4 }],
			spawnRate: 0.5,
		};
		const mergedOptions: WorldOptions = { ...defaultOptions, ...options };

		this.floorHeight = mergedOptions.floorHeight;

		const handleUserCodeError = (e: Error) => {
			this.trigger('usercode_error', e);
		};

		this.floors = World.createFloors(mergedOptions.floorCount, mergedOptions.floorHeight, handleUserCodeError);
		this.elevators = World.createElevators(
			mergedOptions.elevators,
			mergedOptions.floorCount,
			mergedOptions.floorHeight,
		);
		this.elevatorInterfaces = this.elevators.map((elevator) => {
			return new ElevatorInterface(elevator, mergedOptions.floorCount, handleUserCodeError);
		});
		this.spawnRate = mergedOptions.spawnRate;

		// Bind them all together
		for (const elevator of this.elevators) {
			elevator.on('entrance_available', this.#handleElevAvailability);
		}

		// This will cause elevators to "re-arrive" at floors if someone presses an
		// appropriate button on the floor before the elevator has left.
		for (const floor of this.floors) {
			floor.on('up_button_pressed', this.#handleButtonRepressing);
			floor.on('down_button_pressed', this.#handleButtonRepressing);
		}

		this.elapsedSinceSpawn = 1.001 / mergedOptions.spawnRate;
	}

	#recalculateStats() {
		this.transportedPerSec = this.transportedCounter / this.elapsedTime;
		// TODO: Optimize this loop?
		this.moveCount = this.elevators.reduce((sum, elevator) => {
			return sum + elevator.moveCount;
		}, 0);
		this.trigger('stats_changed');
	}

	#registerUser(user: User) {
		this.users.push(user);
		user.updateDisplayPosition(true);
		user.spawnTimestamp = this.elapsedTime;
		this.trigger('new_user', user);
		user.on('exited_elevator', () => {
			this.transportedCounter++;
			this.maxWaitTime = Math.max(this.maxWaitTime, this.elapsedTime - user.spawnTimestamp!);
			this.avgWaitTime =
				(this.avgWaitTime * (this.transportedCounter - 1) + (this.elapsedTime - user.spawnTimestamp!)) /
				this.transportedCounter;
			this.#recalculateStats();
		});
		user.updateDisplayPosition(true);
	}

	#handleElevAvailability = (eventName: string, elevator: Elevator) => {
		// Use regular loops for memory/performance reasons
		// Notify floors first because overflowing users
		// will press buttons again.
		for (let i = 0, len = this.floors.length; i < len; ++i) {
			const floor = this.floors[i];
			if (elevator.currentFloor === i) {
				floor.elevatorAvailable(elevator);
			}
		}
		for (let users = this.users, i = 0, len = users.length; i < len; ++i) {
			const user = users[i];
			if (user.currentFloor === elevator.currentFloor) {
				user.elevatorAvailable(elevator, this.floors[elevator.currentFloor]);
			}
		}
	};

	#handleButtonRepressing = (eventName: 'up_button_pressed' | 'down_button_pressed', floor: Floor) => {
		// Need randomize iteration order or we'll tend to fill upp first elevator
		for (let i = 0, len = this.elevators.length, offset = _.random(len - 1); i < len; ++i) {
			const elevIndex = (i + offset) % len;
			const elevator = this.elevators[elevIndex];
			if (
				(eventName === 'up_button_pressed' && elevator.goingUpIndicator) ||
				(eventName === 'down_button_pressed' && elevator.goingDownIndicator)
			) {
				// Elevator is heading in correct direction, check for suitability
				if (
					elevator.currentFloor === floor.level &&
					elevator.isOnAFloor() &&
					!elevator.isMoving &&
					!elevator.isFull()
				) {
					// Potentially suitable to get into
					// Use the interface queue functionality to queue up this action
					this.elevatorInterfaces[elevIndex].goToFloor(floor.level, true);
					return;
				}
			}
		}
	};

	update(deltaTime: number) {
		this.elapsedTime += deltaTime;
		this.elapsedSinceSpawn += deltaTime;
		this.elapsedSinceStatsUpdate += deltaTime;
		while (this.elapsedSinceSpawn > 1.0 / this.spawnRate) {
			this.elapsedSinceSpawn -= 1.0 / this.spawnRate;
			this.#registerUser(World.spawnUserRandomly(this.floors));
		}

		// Use regular for loops for performance and memory friendlyness
		for (const elevator of this.elevators) {
			elevator.update(deltaTime);
			elevator.updateElevatorMovement(deltaTime);
		}
		for (const user of this.users) {
			user.update(deltaTime);
			this.maxWaitTime = Math.max(this.maxWaitTime, this.elapsedTime - user.spawnTimestamp!);
		}

		for (let i = this.users.length - 1; i >= 0; i--) {
			const user = this.users[i];
			if (user.removeMe) {
				this.users.splice(i, 1);
			}
		}

		this.#recalculateStats();
	}

	updateDisplayPositions() {
		for (const elevator of this.elevators) {
			elevator.updateDisplayPosition();
		}
		for (const user of this.users) {
			user.updateDisplayPosition();
		}
	}

	unWind() {
		console.log('Unwinding', this);

		const eventObjects = (this.elevators as unknown as Emitter[])
			.concat(this.elevatorInterfaces as unknown as Emitter[])
			.concat(this.users as unknown as Emitter[])
			.concat(this.floors as unknown as Emitter[])
			.concat([this] as unknown as Emitter[]);
		for (const object of eventObjects) {
			object.off('*');
		}
		this.challengeEnded = true;
		this.elevators = this.elevatorInterfaces = this.users = this.floors = [];
	}

	init() {
		// Checking the floor queue of the elevators triggers the idle event here
		for (let i = 0; i < this.elevatorInterfaces.length; ++i) {
			this.elevatorInterfaces[i].checkDestinationQueue();
		}
	}
}

type WorldControllerEvents = { timescale_changed: []; usercode_error: [error: unknown] };

export class WorldController extends Emitter<WorldControllerEvents> {
	dtMax: number;
	timeScale = 1.0;
	isPaused = true;

	constructor(dtMax: number) {
		super();

		this.dtMax = dtMax;
	}

	start(
		world: World,
		userModule: UserModule,
		animationFrameRequester: (callback: (time: number) => void) => void,
		autoStart = false,
	) {
		this.isPaused = true;
		let lastT: number | null = null;
		let firstUpdate = true;
		let timeSinceStatsUpdate = Infinity;
		world.on('usercode_error', (eventName, error) => {
			this.handleUserCodeError(error);
		});
		const updater = (t: number) => {
			if (!this.isPaused && !world.challengeEnded && lastT !== null) {
				if (firstUpdate) {
					firstUpdate = false;
					// This logic prevents infite loops in usercode from breaking the page permanently - don't evaluate user code until game is unpaused.
					try {
						userModule.init(world.elevatorInterfaces, world.floors);
						world.init();
					} catch (e) {
						this.handleUserCodeError(e);
					}
				}

				const dt = t - lastT;
				let scaledDt = dt * 0.001 * this.timeScale;
				scaledDt = Math.min(scaledDt, this.dtMax * 3 * this.timeScale); // Limit to prevent unhealthy substepping
				try {
					userModule.update(scaledDt, world.elevatorInterfaces, world.floors);
				} catch (e) {
					this.handleUserCodeError(e as Error);
				}
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				while (scaledDt > 0.0 && !world.challengeEnded) {
					const thisDt = Math.min(this.dtMax, scaledDt);
					world.update(thisDt);
					scaledDt -= this.dtMax;
				}
				world.updateDisplayPositions();

				timeSinceStatsUpdate += dt;

				// Trigger stat update every STATISTICS_UPDATE_INTERVAL ms
				if (timeSinceStatsUpdate >= config.STATISTICS_UPDATE_INTERVAL) {
					world.trigger('stats_display_changed');
					timeSinceStatsUpdate = 0;
				}
			}
			lastT = t;
			if (!world.challengeEnded) {
				animationFrameRequester(updater);
			}

			if (world.challengeEnded || this.isPaused) {
				if (timeSinceStatsUpdate > 0) {
					// Immediately update stats if the simulation is paused or completed
					world.trigger('stats_display_changed');
					timeSinceStatsUpdate = 0;
				}
			}
		};
		if (autoStart) {
			this.setPaused(false);
		}
		animationFrameRequester(updater);
	}

	handleUserCodeError(error: unknown) {
		this.setPaused(true);
		console.log('Usercode error on update', error);
		this.trigger('usercode_error', error);
	}

	setPaused(paused: boolean) {
		this.isPaused = paused;
		this.trigger('timescale_changed');
	}
	setTimeScale(timeScale: number) {
		this.timeScale = timeScale;
		this.trigger('timescale_changed');
	}
}
