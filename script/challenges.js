export const requireUserCountWithinTime = function (userCount, timeLimit) {
	return {
		description: `Transport <span class='emphasis-color'>${userCount}</span> people in <span class='emphasis-color'>${timeLimit.toFixed(0)}</span> seconds or less`,
		evaluate: function (world) {
			if (world.elapsedTime >= timeLimit || world.transportedCounter >= userCount) {
				return world.elapsedTime <= timeLimit && world.transportedCounter >= userCount;
			} else {
				return null;
			}
		},
	};
};

export const requireUserCountWithMaxWaitTime = function (userCount, maxWaitTime) {
	return {
		description: `Transport <span class='emphasis-color'>${userCount}</span> people and let no one wait more than <span class='emphasis-color'>${maxWaitTime.toFixed(1)}</span> seconds`,
		evaluate: function (world) {
			if (world.maxWaitTime >= maxWaitTime || world.transportedCounter >= userCount) {
				return world.maxWaitTime <= maxWaitTime && world.transportedCounter >= userCount;
			} else {
				return null;
			}
		},
	};
};

export const requireUserCountWithinTimeWithMaxWaitTime = function (userCount, timeLimit, maxWaitTime) {
	return {
		description: `Transport <span class='emphasis-color'>${userCount}</span> people in <span class='emphasis-color'>${timeLimit.toFixed(0)}</span> seconds or less and let no one wait more than <span class='emphasis-color'>${maxWaitTime.toFixed(1)}</span> seconds`,
		evaluate: function (world) {
			if (
				world.elapsedTime >= timeLimit ||
				world.maxWaitTime >= maxWaitTime ||
				world.transportedCounter >= userCount
			) {
				return (
					world.elapsedTime <= timeLimit &&
					world.maxWaitTime <= maxWaitTime &&
					world.transportedCounter >= userCount
				);
			} else {
				return null;
			}
		},
	};
};

export const requireUserCountWithinMoves = function (userCount, moveLimit) {
	return {
		description: `Transport <span class='emphasis-color'>${userCount}</span> people using <span class='emphasis-color'>${moveLimit}</span> elevator moves or less`,
		evaluate: function (world) {
			if (world.moveCount >= moveLimit || world.transportedCounter >= userCount) {
				return world.moveCount <= moveLimit && world.transportedCounter >= userCount;
			} else {
				return null;
			}
		},
	};
};

export const requireDemo = function () {
	return {
		description: 'Perpetual demo',
		evaluate: function () {
			return null;
		},
	};
};

export function getElevatorConfig(count, capacity = 4) {
	if (typeof capacity !== 'object') {
		capacity = [capacity];
	}

	return Array.from({ length: count }, (_, index) => {
		return { capacity: capacity[index % capacity.length] };
	});
}

export const challenges = [
	{
		options: { floorCount: 3, elevators: [{ capacity: 4 }], spawnRate: 0.3 },
		condition: requireUserCountWithinTime(15, 60),
	},
	{
		options: { floorCount: 5, elevators: [{ capacity: 4 }], spawnRate: 0.4 },
		condition: requireUserCountWithinTime(20, 60),
	},
	{
		options: { floorCount: 5, elevators: [{ capacity: 6 }], spawnRate: 0.5 },
		condition: requireUserCountWithinTime(23, 60),
	},
	{
		options: { floorCount: 8, elevators: getElevatorConfig(2, 4), spawnRate: 0.6 },
		condition: requireUserCountWithinTime(28, 60),
	},
	{
		options: { floorCount: 6, elevators: getElevatorConfig(4, 4), spawnRate: 1.7 },
		condition: requireUserCountWithinTime(100, 68),
	},
	{
		options: { floorCount: 4, elevators: getElevatorConfig(2, 4), spawnRate: 0.8 },
		condition: requireUserCountWithinMoves(40, 60),
	},
	{
		options: { floorCount: 3, elevators: getElevatorConfig(3, 4), spawnRate: 3.0 },
		condition: requireUserCountWithinMoves(100, 63),
	},
	{
		options: { floorCount: 6, elevators: getElevatorConfig(2, 5), spawnRate: 0.4 },
		condition: requireUserCountWithMaxWaitTime(50, 21),
	},
	{
		options: { floorCount: 7, elevators: getElevatorConfig(3, 4), spawnRate: 0.6 },
		condition: requireUserCountWithMaxWaitTime(50, 20),
	},

	{
		options: { floorCount: 13, elevators: getElevatorConfig(2, [4, 10]), spawnRate: 1.1 },
		condition: requireUserCountWithinTime(50, 70),
	},

	{
		options: { floorCount: 9, elevators: getElevatorConfig(5, 4), spawnRate: 1.1 },
		condition: requireUserCountWithMaxWaitTime(60, 19),
	},
	{
		options: { floorCount: 9, elevators: getElevatorConfig(5, 4), spawnRate: 1.1 },
		condition: requireUserCountWithMaxWaitTime(80, 17),
	},
	{
		options: { floorCount: 9, elevators: getElevatorConfig(5, 5), spawnRate: 1.1 },
		condition: requireUserCountWithMaxWaitTime(100, 15),
	},
	{
		options: { floorCount: 9, elevators: getElevatorConfig(5, 6), spawnRate: 1.0 },
		condition: requireUserCountWithMaxWaitTime(110, 15),
	},
	{
		options: { floorCount: 8, elevators: getElevatorConfig(6, 4), spawnRate: 0.9 },
		condition: requireUserCountWithMaxWaitTime(120, 14),
	},

	{
		options: { floorCount: 12, elevators: getElevatorConfig(4, [5, 10]), spawnRate: 1.4 },
		condition: requireUserCountWithinTime(70, 80),
	},
	{
		options: { floorCount: 21, elevators: getElevatorConfig(5, 10), spawnRate: 1.9 },
		condition: requireUserCountWithinTime(110, 80),
	},

	{
		options: { floorCount: 21, elevators: getElevatorConfig(8, [6, 8]), spawnRate: 1.5 },
		condition: requireUserCountWithinTimeWithMaxWaitTime(2675, 1800, 45),
	},

	{ options: { floorCount: 21, elevators: getElevatorConfig(8, [6, 8]), spawnRate: 1.5 }, condition: requireDemo() },
];
