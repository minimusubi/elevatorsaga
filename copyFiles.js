import { relative, resolve } from 'path';
import { copy } from 'fs-extra';
import { glob } from 'glob';
import { stat } from 'fs/promises';

const SOURCE = './src';
const DESTINATION = './dist';

const files = await glob(`${SOURCE}/**/*`, { ignore: `${SOURCE}/**/*.ts` });

for (const file of files) {
	const stats = await stat(file);

	if (!stats.isFile()) {
		continue;
	}

	const relativePath = relative(SOURCE, file);
	const destinationPath = relative(process.cwd(), resolve(DESTINATION, relativePath));

	await copy(file, destinationPath);
	console.log(file, '->', destinationPath);
}
