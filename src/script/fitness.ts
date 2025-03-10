import { Challenge, getElevatorConfig } from './challenges.js';
import { UserModule, createFrameRequester, getModuleFromUserCode } from './base.js';
import { World, WorldController } from './world.js';

const requireNothing = function () {
	return {
		description: 'No requirement',
		evaluate: function () {
			return null;
		},
	};
};

const fitnessChallenges = [
	{
		options: { description: 'Small scenario', floorCount: 4, elevators: getElevatorConfig(2, 4), spawnRate: 0.6 },
		condition: requireNothing(),
	},
	{
		options: { description: 'Medium scenario', floorCount: 6, elevators: getElevatorConfig(3, 5), spawnRate: 1.5 },
		condition: requireNothing(),
	},
	{
		options: { description: 'Large scenario', floorCount: 18, elevators: getElevatorConfig(6, 8), spawnRate: 1.9 },
		condition: requireNothing(),
	},
];

interface FitnessResult {
	error?: unknown;
	transportedPerSec?: number;
	avgWaitTime?: number;
	transportedCount?: number;
}

// Simulation without visualisation
function calculateFitness(challenge: Challenge, codeObj: UserModule, stepSize: number, stepsToSimulate: number) {
	const controller = new WorldController(stepSize);
	const result: Partial<FitnessResult> = {};

	const world = new World(challenge.options);
	const frameRequester = createFrameRequester(stepSize);

	controller.on('usercode_error', (eventName, error) => {
		result.error = error;
	});
	world.on('stats_changed', () => {
		result.transportedPerSec = world.transportedPerSec;
		result.avgWaitTime = world.avgWaitTime;
		result.transportedCount = world.transportedCounter;
	});

	controller.start(world, codeObj, frameRequester.register, true);

	for (let stepCount = 0; stepCount < stepsToSimulate && !controller.isPaused; stepCount++) {
		frameRequester.trigger();
	}
	return result;
}

function makeAverageResult(results) {
	const averagedResult = {};
	_.forOwn(results[0].result, (value, resultProperty) => {
		const sum = _.sum(_.pluck(_.pluck(results, 'result'), resultProperty));
		averagedResult[resultProperty] = sum / results.length;
	});
	return { options: results[0].options, result: averagedResult };
}

function doFitnessSuite(codeStr: string, runCount: number) {
	let userModule;
	try {
		userModule = getModuleFromUserCode(codeStr);
	} catch (e) {
		return { error: `${e}` };
	}
	console.log('Fitness testing code', userModule);
	let error: unknown | null = null;

	const testruns = [];
	_.times(runCount, () => {
		const results = _.map(fitnessChallenges, (challenge) => {
			const fitness = calculateFitness(challenge, userModule, 1000.0 / 60.0, 12000);
			if (fitness.error) {
				error = fitness.error;
				return;
			}
			return { options: challenge.options, result: fitness };
		});
		if (error) {
			return;
		}
		testruns.push(results);
	});
	if (error) {
		return { error: `${error}` };
	}

	// Now do averaging over all properties for each challenge's test runs
	const averagedResults = _.map(_.range(testruns[0].length), (n) => {
		return makeAverageResult(_.pluck(testruns, n));
	});

	return averagedResults;
}

function fitnessSuite(codeStr: string, preferWorker: boolean, callback: (results: any) => void) {
	if (!!Worker && preferWorker) {
		// Web workers are available, neat.
		try {
			const w = new Worker('script/worker/fitnessworker.js');
			w.postMessage(codeStr);
			w.onmessage = function (msg) {
				console.log('Got message from fitness worker', msg);
				const results = msg.data;
				callback(results);
			};
			return;
		} catch (e) {
			console.log('Fitness worker creation failed, falling back to normal', e);
		}
	}
	// Fall back do synch calculation without web worker
	const results = doFitnessSuite(codeStr, 2);
	callback(results);
}
