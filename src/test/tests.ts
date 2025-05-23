/* eslint-disable @typescript-eslint/unbound-method */
import * as _ from 'https://unpkg.com/radashi@12.4.0/dist/radashi.js';
import { FrameRequester, UserModule, createFrameRequester, getModuleFromUserCode } from '../script/base.js';
import { World, WorldController } from '../script/world.js';
import {
	requireUserCountWithMaxWaitTime,
	requireUserCountWithinMoves,
	requireUserCountWithinTime,
	requireUserCountWithinTimeWithMaxWaitTime,
} from '../script/challenges.js';
import Elevator from '../script/elevator.js';
import { ElevatorInterface } from '../script/interfaces.js';
import Emitter from '../script/emitter.js';
import Movable from '../script/movable.js';
import User from '../script/user.js';

const timeForwarder = function (deltaTime: number, stepSize: number, fn: (time: number) => void) {
	let accumulated = 0.0;
	while (accumulated < deltaTime) {
		accumulated += stepSize;
		fn(stepSize);
	}
};

describe('Elevator Saga', () => {
	// @ts-expect-error Guaranteed to be non-null during the tests
	let handlers: { someHandler: jasmine.Spy; someOtherHandler: jasmine.Spy } = null;
	beforeEach(() => {
		// @ts-expect-error calls gets added by jasmine
		handlers = { someHandler: function () {}, someOtherHandler: function () {} };
		for (const [key, value] of Object.entries(handlers)) {
			spyOn(handlers, key).and.callThrough();
		}
	});

	describe('Movable class', () => {
		// @ts-expect-error Guaranteed to be non-null during the tests
		let m: Movable = null;

		beforeEach(() => {
			m = new Movable();
		});
		it('disallows incorrect creation', () => {
			const faultyCreation = function () {
				// @ts-expect-error This test expects failure
				Movable();
			};
			expect(faultyCreation).toThrow();
		});
		it('updates display position when told to', () => {
			m.moveTo(1.0, 1.0);
			m.updateDisplayPosition();
			expect(m.worldX).toBe(1.0);
			expect(m.worldY).toBe(1.0);
		});
	});

	describe('User class', () => {
		// @ts-expect-error Guaranteed to be non-null during the tests
		let u: User = null;

		beforeEach(() => {
			u = new User(60, 'child');
		});
		it('updates display position when told to', () => {
			u.moveTo(1.0, 1.0);
			u.updateDisplayPosition();
			expect(u.worldX).toBe(1.0);
			expect(u.worldY).toBe(1.0);
		});
	});

	describe('Movable object', () => {
		// @ts-expect-error Guaranteed to be non-null during the tests
		let m: Movable = null;

		beforeEach(() => {
			m = new Movable();
		});

		it('updates display position when told to', () => {
			m.moveTo(1.0, 1.0);
			m.updateDisplayPosition();
			expect(m.worldX).toBe(1.0);
			expect(m.worldY).toBe(1.0);
		});
		it('does not update display position when moved', () => {
			m.moveTo(1.0, 1.0);
			expect(m.worldX).toBe(0.0);
			expect(m.worldY).toBe(0.0);
		});
		it('triggers event when moved', () => {
			m.on('new_state', handlers.someHandler);
			m.moveTo(1.0, 1.0);
			expect(handlers.someHandler).toHaveBeenCalled();
		});
		it('retains x pos when moveTo x is null', () => {
			m.moveTo(1.0, 1.0);
			m.moveTo(null, 2.0);
			expect(m.x).toBe(1.0);
		});
		it('retains y pos when moveTo y is null', () => {
			m.moveTo(1.0, 1.0);
			m.moveTo(2.0, null);
			expect(m.y).toBe(1.0);
		});
		it('gets new display position when parent is moved', () => {
			const mParent = new Movable();
			m.setParent(mParent);
			mParent.moveTo(2.0, 3.0);
			m.updateDisplayPosition();
			expect(m.x).toBe(0.0);
			expect(m.y).toBe(0.0);
			expect(m.worldX).toBe(2.0);
			expect(m.worldY).toBe(3.0);
		});
		it('moves to destination over time', () => {
			// obj.moveToOverTime = function(newX, newY, timeToSpend, interpolator, cb) {
			m.moveToOverTime(2.0, 3.0, 10.0, handlers.someHandler);
			timeForwarder(10.0, 0.1, (dt) => {
				m.update(dt);
			});
			expect(m.x).toBe(2.0);
			expect(m.y).toBe(3.0);
			expect(handlers.someHandler).toHaveBeenCalled();
		});
	});

	describe('World controller', () => {
		// @ts-expect-error Guaranteed to be non-null during the tests
		let controller: WorldController = null;
		// @ts-expect-error Guaranteed to be non-null during the tests
		let fakeWorld: World = null;
		// @ts-expect-error Guaranteed to be non-null during the tests
		let fakeCodeObj: UserModule = null;
		// @ts-expect-error Guaranteed to be non-null during the tests
		let frameRequester: FrameRequester = null;
		const DT_MAX = 1000.0 / 59;
		beforeEach(() => {
			controller = new WorldController(DT_MAX);
			fakeWorld = new Emitter() as World;
			fakeWorld.update = function () {};
			fakeWorld.init = function () {};
			fakeWorld.updateDisplayPositions = function () {};
			fakeWorld.trigger = function () {};
			fakeCodeObj = { init: function () {}, update: function () {} };
			frameRequester = createFrameRequester(10.0);
			spyOn(fakeWorld, 'update').and.callThrough();
		});
		it('does not update world on first animation frame', () => {
			controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
			frameRequester.trigger();
			expect(fakeWorld.update).not.toHaveBeenCalled();
		});
		it('calls world update with correct delta t', () => {
			controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
			frameRequester.trigger();
			frameRequester.trigger();
			expect(fakeWorld.update).toHaveBeenCalledWith(0.01);
		});
		it('calls world update with scaled delta t', () => {
			controller.timeScale = 2.0;
			controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
			frameRequester.trigger();
			frameRequester.trigger();
			expect(fakeWorld.update).toHaveBeenCalledWith(0.02);
		});
		it('does not update world when paused', () => {
			controller.start(fakeWorld, fakeCodeObj, frameRequester.register, true);
			controller.isPaused = true;
			frameRequester.trigger();
			frameRequester.trigger();
			expect(fakeWorld.update).not.toHaveBeenCalled();
		});
	});

	describe('Challenge requirements', () => {
		// @ts-expect-error Guaranteed to be non-null during the tests
		let fakeWorld: World = null;
		beforeEach(() => {
			fakeWorld = { elapsedTime: 0.0, transportedCounter: 0, maxWaitTime: 0.0, moveCount: 0 } as World;
		});

		describe('requireUserCountWithinTime', () => {
			it('evaluates correctly', () => {
				const challengeReq = requireUserCountWithinTime(10, 5.0);
				expect(challengeReq.evaluate(fakeWorld)).toBe(null);
				fakeWorld.elapsedTime = 5.1;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
				fakeWorld.transportedCounter = 11;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
				fakeWorld.elapsedTime = 4.9;
				expect(challengeReq.evaluate(fakeWorld)).toBe(true);
			});
		});
		describe('requireUserCountWithMaxWaitTime', () => {
			it('evaluates correctly', () => {
				const challengeReq = requireUserCountWithMaxWaitTime(10, 4.0);
				expect(challengeReq.evaluate(fakeWorld)).toBe(null);
				fakeWorld.maxWaitTime = 4.5;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
				fakeWorld.transportedCounter = 11;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
				fakeWorld.maxWaitTime = 3.9;
				expect(challengeReq.evaluate(fakeWorld)).toBe(true);
			});
		});
		describe('requireUserCountWithinMoves', () => {
			it('evaluates correctly', () => {
				const challengeReq = requireUserCountWithinMoves(10, 20);
				expect(challengeReq.evaluate(fakeWorld)).toBe(null);
				fakeWorld.moveCount = 21;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
				fakeWorld.transportedCounter = 11;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
				fakeWorld.moveCount = 20;
				expect(challengeReq.evaluate(fakeWorld)).toBe(true);
			});
		});
		describe('requireUserCountWithinTimeWithMaxWaitTime', () => {
			it('evaluates correctly', () => {
				const challengeReq = requireUserCountWithinTimeWithMaxWaitTime(10, 5.0, 4.0);
				expect(challengeReq.evaluate(fakeWorld)).toBe(null);
				fakeWorld.elapsedTime = 5.1;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
				fakeWorld.transportedCounter = 11;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
				fakeWorld.elapsedTime = 4.9;
				expect(challengeReq.evaluate(fakeWorld)).toBe(true);
				fakeWorld.maxWaitTime = 4.1;
				expect(challengeReq.evaluate(fakeWorld)).toBe(false);
			});
		});
	});

	describe('Elevator object', () => {
		// @ts-expect-error Guaranteed to be non-null during the tests
		let e: Elevator = null;
		const floorCount = 4;
		const floorHeight = 44;

		beforeEach(() => {
			e = new Elevator(1.5, floorCount, floorHeight);
			e.setFloorPosition(0);
		});

		it('moves to floors specified', () => {
			for (let floor = 0; floor < floorCount - 1; floor++) {
				e.goToFloor(floor);
				timeForwarder(10.0, 0.015, (dt) => {
					e.update(dt);
					e.updateElevatorMovement(dt);
				});
				const expectedY = floorHeight * (floorCount - 1) - floorHeight * floor;
				expect(e.y).toBe(expectedY);
				expect(e.currentFloor).toBe(floor, 'Floor num');
			}
		});

		it('can change direction', () => {
			expect(e.currentFloor).toBe(0);
			const originalY = e.y;
			e.goToFloor(1);
			timeForwarder(0.2, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.y).not.toBe(originalY);
			e.goToFloor(0);
			timeForwarder(10.0, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.y).toBe(originalY);
			expect(e.currentFloor).toBe(0);
		});

		it('is correctly aware of it being on a floor', () => {
			expect(e.isOnAFloor()).toBe(true);
			e.y = e.y + 0.0000000000000001;
			expect(e.isOnAFloor()).toBe(true);
			e.y = e.y + 0.0001;
			expect(e.isOnAFloor()).toBe(false);
		});

		it('correctly reports travel suitability', () => {
			e.goingUpIndicator = true;
			e.goingDownIndicator = true;
			expect(e.isSuitableForTravelBetween(0, 1)).toBe(true);
			expect(e.isSuitableForTravelBetween(2, 4)).toBe(true);
			expect(e.isSuitableForTravelBetween(5, 3)).toBe(true);
			expect(e.isSuitableForTravelBetween(2, 0)).toBe(true);
			e.goingUpIndicator = false;
			expect(e.isSuitableForTravelBetween(1, 10)).toBe(false);
			e.goingDownIndicator = false;
			expect(e.isSuitableForTravelBetween(20, 0)).toBe(false);
		});

		it('reports pressed floor buttons', () => {
			e.pressFloorButton(2);
			e.pressFloorButton(3);
			expect(e.getPressedFloors()).toEqual([2, 3]);
		});

		it('reports not approaching floor 0 when going up from floor 0', () => {
			e.goToFloor(1);
			timeForwarder(0.01, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.isApproachingFloor(0)).toBe(false);
		});

		it('reports approaching floor 2 when going up from floor 0', () => {
			e.goToFloor(1);
			timeForwarder(0.01, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.isApproachingFloor(2)).toBe(true);
		});

		it('reports approaching floor 2 when going down from floor 3', () => {
			e.setFloorPosition(3);
			e.goToFloor(2);
			timeForwarder(0.01, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.isApproachingFloor(2)).toBe(true);
		});

		it('emits no passing floor events when going from floor 0 to 1', () => {
			e.on('passing_floor', handlers.someHandler);
			e.on('passing_floor', (event, floorNum, direction) => {
				console.log('Passing floor yo', floorNum, direction);
			});
			e.goToFloor(1);
			timeForwarder(10.0, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.currentFloor).toBe(1);
			expect(handlers.someHandler).not.toHaveBeenCalled();
		});
		it('emits passing floor event when going from floor 0 to 2', () => {
			e.on('passing_floor', handlers.someHandler);
			e.goToFloor(2);
			timeForwarder(10.0, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.currentFloor).toBe(2);
			expect(handlers.someHandler.calls.count()).toEqual(1);
			expect(handlers.someHandler.calls.mostRecent().args.slice(1, 2)).toEqual([1]);
		});
		it('emits passing floor events when going from floor 0 to 3', () => {
			e.on('passing_floor', handlers.someHandler);
			e.goToFloor(3);
			timeForwarder(10.0, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.currentFloor).toBe(3);
			expect(handlers.someHandler.calls.count()).toEqual(2);
			expect(handlers.someHandler.calls.argsFor(0).slice(1, 2)).toEqual([1]);
			expect(handlers.someHandler.calls.argsFor(1).slice(1, 2)).toEqual([2]);
		});
		it('emits passing floor events when going from floor 3 to 0', () => {
			e.on('passing_floor', handlers.someHandler);
			e.goToFloor(3);
			timeForwarder(10.0, 0.015, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(e.currentFloor).toBe(3);
			expect(handlers.someHandler.calls.count()).toEqual(2);
			expect(handlers.someHandler.calls.argsFor(0).slice(1, 2)).toEqual([1]);
			expect(handlers.someHandler.calls.argsFor(1).slice(1, 2)).toEqual([2]);
		});
		it('doesnt raise unexpected events when told to stop(ish) when passing floor', () => {
			let passingFloorEventCount = 0;
			e.on('passing_floor', (event, floorNum, direction) => {
				expect(floorNum).toBe(1, 'floor being passed');
				expect(direction).toBe('up');
				passingFloorEventCount++;
				e.goToFloor(e.getExactFutureFloorIfStopped());
			});
			e.goToFloor(2);
			timeForwarder(3.0, 0.01401, (dt) => {
				e.update(dt);
				e.updateElevatorMovement(dt);
			});
			expect(passingFloorEventCount).toBeGreaterThan(0, 'event count');
			expect(e.getExactCurrentFloor()).toBeLessThan(1.15, 'current floor');
		});

		it('doesnt seem to overshoot when stopping at floors', () => {
			for (let updatesPerSecond = 60; updatesPerSecond < 120; updatesPerSecond += 2.32133) {
				const STEPSIZE = 1.0 / updatesPerSecond;
				e.setFloorPosition(1);
				e.goToFloor(3);
				timeForwarder(5.0, STEPSIZE, (dt) => {
					e.update(dt);
					e.updateElevatorMovement(dt);
					// @ts-expect-error Types are not accurate for the version of jasmine used
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call
					expect(e.getExactCurrentFloor()).toBeWithinRange(1.0, 3.0, `(STEPSIZE is ${STEPSIZE})`);
				});
				expect(e.getExactCurrentFloor()).toEqual(3.0);
			}
		});
	});

	describe('API', () => {
		describe('Elevator interface', () => {
			// @ts-expect-error Guaranteed to be non-null during the tests
			let e: Elevator = null;
			// @ts-expect-error Guaranteed to be non-null during the tests
			let elevInterface: ElevatorInterface = null;
			beforeEach(() => {
				e = new Elevator(1.5, 4, 40);
				e.setFloorPosition(0);
				elevInterface = new ElevatorInterface(e, 4, () => {});
			});

			describe('events', () => {
				it('propagates stopped_at_floor event', () => {
					elevInterface.on('stopped_at_floor', handlers.someHandler);
					e.trigger('stopped_at_floor', 3);
					expect(handlers.someHandler.calls.mostRecent().args.slice(1, 2)).toEqual([3]);
				});

				it('does not propagate stopped event', () => {
					// @ts-expect-error The 'stopped' event is not part of the interface
					elevInterface.on('stopped', handlers.someHandler);
					e.trigger('stopped', 3.1);
					expect(handlers.someHandler).not.toHaveBeenCalled();
				});

				it('triggers idle event at start', () => {
					elevInterface.on('idle', handlers.someHandler);
					elevInterface.checkDestinationQueue();
					expect(handlers.someHandler).toHaveBeenCalled();
				});

				it('triggers idle event when queue empties', () => {
					elevInterface.on('idle', handlers.someHandler);
					elevInterface.destinationQueue = [11, 21];
					e.y = 11;
					e.trigger('stopped', e.y);
					expect(handlers.someHandler).not.toHaveBeenCalled();
					e.y = 21;
					e.trigger('stopped', e.y);
					expect(handlers.someHandler).toHaveBeenCalled();
				});
			});

			it('stops when told told to stop', () => {
				const originalY = e.y;
				elevInterface.goToFloor(2);
				timeForwarder(10, 0.015, (dt) => {
					e.update(dt);
					e.updateElevatorMovement(dt);
				});
				expect(e.y).not.toBe(originalY);

				elevInterface.goToFloor(0);
				timeForwarder(0.2, 0.015, (dt) => {
					e.update(dt);
					e.updateElevatorMovement(dt);
				});
				const whenMovingY = e.y;

				elevInterface.stop();
				timeForwarder(10, 0.015, (dt) => {
					e.update(dt);
					e.updateElevatorMovement(dt);
				});
				expect(e.y).not.toBe(whenMovingY);
				expect(e.y).not.toBe(originalY);
			});

			describe('destination direction', () => {
				it('reports up when going up', () => {
					e.setFloorPosition(1);
					elevInterface.goToFloor(1);
					expect(elevInterface.destinationDirection()).toBe('stopped');
				});
				it('reports up when going up', () => {
					elevInterface.goToFloor(1);
					expect(elevInterface.destinationDirection()).toBe('up');
				});
				it('reports down when going down', () => {
					e.setFloorPosition(3);
					elevInterface.goToFloor(2);
					expect(elevInterface.destinationDirection()).toBe('down');
				});
			});

			it('stores going up and going down properties', () => {
				expect(e.goingUpIndicator).toBe(true);
				expect(e.goingDownIndicator).toBe(true);
				expect(elevInterface.goingUpIndicator()).toBe(true);
				expect(elevInterface.goingDownIndicator()).toBe(true);

				elevInterface.goingUpIndicator(false);
				expect(elevInterface.goingUpIndicator()).toBe(false);
				expect(elevInterface.goingDownIndicator()).toBe(true);

				elevInterface.goingDownIndicator(false);
				expect(elevInterface.goingDownIndicator()).toBe(false);
				expect(elevInterface.goingUpIndicator()).toBe(false);
			});

			it('can chain calls to going up and down indicator functions', () => {
				elevInterface.goingUpIndicator(false).goingDownIndicator(false);
				expect(elevInterface.goingUpIndicator()).toBe(false);
				expect(elevInterface.goingDownIndicator()).toBe(false);
			});

			it('normalizes load factor', () => {
				const fnNewUser = function () {
						return { weight: _.random(55, 100) } as User;
					},
					fnEnterElevator = function (user: User) {
						e.userEntering(user);
					};

				[..._.range(19)].map(fnNewUser).forEach(fnEnterElevator);
				const load = elevInterface.loadFactor();
				expect(load >= 0 && load <= 1).toBeTruthy();
			});

			it('doesnt raise unexpected events when told to stop when passing floor', () => {
				e.setFloorPosition(2);
				elevInterface.goToFloor(0);
				let passingFloorEventCount = 0;
				elevInterface.on('passing_floor', (event, floorNum, direction) => {
					passingFloorEventCount++;
					// We only expect to be passing floor 1, but it is possible and ok that several
					// such events are raised, due to possible overshoot.
					expect(floorNum).toBe(1, 'floor being passed');
					elevInterface.stop();
				});
				timeForwarder(3.0, 0.01401, (dt) => {
					e.update(dt);
					e.updateElevatorMovement(dt);
				});
				expect(passingFloorEventCount).toBeGreaterThan(0);
			});
		});
	});

	describe('base', () => {
		describe('getModuleFromUserCode', () => {
			const testCode = 'export function init() {} export function update() {}';
			it('handles trailing whitespace', () => {
				expect(getModuleFromUserCode(`${testCode}\n`)).toEqual(jasmine.any(Object));
			});
			it('handles prefix whitespace', () => {
				expect(getModuleFromUserCode(`\n${testCode}`)).toEqual(jasmine.any(Object));
			});
			it('handles prefix and trailing whitespace', () => {
				expect(getModuleFromUserCode(`\n${testCode}\n`)).toEqual(jasmine.any(Object));
			});
		});
	});
});
