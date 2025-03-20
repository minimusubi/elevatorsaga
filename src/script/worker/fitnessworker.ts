import { TestRun, doFitnessSuite } from '../fitness.js';

export interface FitnessWorkerMessage {
	results?: TestRun[];
	error?: any;
}

onmessage = async function (msg) {
	// Assume it is a code object that should be fitness-tested
	const codeStr = msg.data as string;
	const message: FitnessWorkerMessage = {};

	try {
		message.results = await doFitnessSuite(codeStr, 6);
	} catch (error) {
		message.error = error;
	}

	console.log('Posting message back', message);
	postMessage(message);
};
