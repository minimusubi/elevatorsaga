import * as _ from 'https://unpkg.com/radashi@12.4.0/dist/radashi.js';
import { Challenge, getElevatorConfig } from './challenges.js';
import { UserModule, createFrameRequester, getModuleFromUserCode } from './base.js';
import { World, WorldController, WorldOptions } from './world.js';
import { FitnessWorkerMessage } from './worker/fitnessworker.js';

const requireNothing: () => FitnessCondition = function () {
	return {
		description: 'No requirement',
		evaluate: function () {
			return null;
		},
	};
};

type TestOptions = Omit<WorldOptions, 'floorHeight'> & { description: string };

interface FitnessCondition {
	description: 'No requirement';
	evaluate: () => null | boolean;
}

interface FitnessChallenge {
	options: TestOptions;
	condition: FitnessCondition;
}

const fitnessChallenges: FitnessChallenge[] = [
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
	avgWaitTime: number;
	transportedCount: number;
	transportedPerSec: number;
}

export interface TestRun {
	options: TestOptions;
	result: FitnessResult;
}

// Simulation without visualisation
function calculateFitness(challenge: Challenge, codeObj: UserModule, stepSize: number, stepsToSimulate: number) {
	const controller = new WorldController(stepSize);
	const result: Partial<FitnessResult> = {};

	const world = new World(challenge.options);
	const frameRequester = createFrameRequester(stepSize);

	controller.on('usercode_error', (eventName, error) => {
		throw error;
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
	return result as FitnessResult;
}

function makeAverageResult(results: TestRun[]): TestRun {
	console.log({ results });

	const averagedResult: Partial<FitnessResult> = {};
	for (const [property] of Object.entries(results[0].result) as [keyof FitnessResult, number][]) {
		const sum = _.sum(
			results.map((result) => {
				return result.result[property];
			}),
		);
		averagedResult[property] = sum / results.length;
	}
	return { options: results[0].options, result: averagedResult as FitnessResult };
}

/**
 * @throws
 */
export async function doFitnessSuite(codeStr: string, runCount: number) {
	const userModule = await getModuleFromUserCode(codeStr);
	console.log('Fitness testing code', userModule);

	const testruns: TestRun[][] = [];
	for (let i = 0; i < runCount; i++) {
		const results = fitnessChallenges.map((challenge) => {
			const fitness = calculateFitness(challenge, userModule, 1000.0 / 60.0, 12000);
			return { options: challenge.options, result: fitness };
		});
		testruns.push(results);
	}

	// Now do averaging over all properties for each challenge's test runs
	const averagedResults = [..._.range(testruns[0].length - 1)].map((index) => {
		return makeAverageResult(testruns[index]);
	});

	return averagedResults;
}

export async function fitnessSuite(codeStr: string, preferWorker: boolean): Promise<TestRun[]> {
	return new Promise((resolve, reject) => {
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Web worker browser check
		if (!!Worker && preferWorker) {
			// Web workers are available, neat.
			try {
				const w = new Worker('script/worker/fitnessworker.js');
				w.postMessage(codeStr);
				w.onmessage = function (msg) {
					console.log('Got message from fitness worker', msg);
					const message = msg.data as FitnessWorkerMessage;

					if (message.error) {
						// eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
						reject(message.error);
					} else {
						resolve(message.results!);
					}
				};
				return;
			} catch (e) {
				console.log('Fitness worker creation failed, falling back to normal', e);
			}
		}
		// Fall back do synch calculation without web worker
		doFitnessSuite(codeStr, 2).then(resolve).catch(reject);
	});
}
