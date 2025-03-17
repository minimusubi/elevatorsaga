/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { exec, spawn } from 'node:child_process';
import process from 'node:process';

// Function to run a command and return a promise
function runCommand(command, ignoreError = false) {
	return new Promise((resolve, reject) => {
		const cmd = exec(command);

		cmd.stdout.pipe(process.stdout);
		cmd.stderr.pipe(process.stderr);

		cmd.on('close', (code) => {
			if (!ignoreError && code !== 0) {
				reject(new Error(`Command "${command}" exited with code ${code}`));
			} else {
				resolve();
			}
		});
	});
}

async function runInitialCommands() {
	try {
		await runCommand('npm run clean');
		await runCommand('npm run compile', true);
	} catch (error) {
		console.error(error);
		process.exit(1);
	}
}

// Function to run the watcher commands
function runWatchers() {
	const commands = [
		{ command: 'npx', args: ['tsc', '--watch'] },
		{ command: 'npx', args: ['nodemon', '--watch', 'src', '-e', 'js,html,css', '--exec', 'npm run copy'] },
	];

	const processes = commands.map((cmd) => {
		const proc = spawn(cmd.command, cmd.args, { stdio: 'inherit', shell: true });
		proc.on('close', (code, signal) => {
			if (signal === null) {
				console.log(`Command "${cmd.command} ${cmd.args.join(' ')}" exited with code ${code}`);
			} else {
				console.log(`Command "${cmd.command} ${cmd.args.join(' ')}" killed`);
			}
		});
		return proc;
	});

	// Handle Ctrl + C
	process.on('SIGINT', () => {
		console.log('Terminating processes...');
		for (const process of processes) {
			process.kill('SIGINT');
		}
	});
}

await runInitialCommands();
runWatchers();
