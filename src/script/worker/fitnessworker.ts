import { doFitnessSuite } from '../fitness.js';

// TODO: use js modules? will not work with ES6+ refactor
importScripts('libs/lodash.min.js', 'libs/riot.js');
importScripts(
	'script/base.js',
	'script/movable.js',
	'script/floor.js',
	'script/user.js',
	'script/elevator.js',
	'script/interfaces.js',
	'script/world.js',
	'script/fitness.js',
);

onmessage = async function (msg) {
	// Assume it is a code object that should be fitness-tested
	const codeStr = msg.data as string;
	const results = await doFitnessSuite(codeStr, 6);
	console.log('Posting message back', results);
	postMessage(results);
};
