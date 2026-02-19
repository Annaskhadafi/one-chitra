import { spawn } from 'child_process';

console.log("Starting auto-push...");
const child = spawn('npx', ['drizzle-kit', 'push'], {
    shell: true,
    stdio: ['pipe', 'inherit', 'inherit'],
});

const interval = setInterval(() => {
    if (child.stdin && !child.killed) {
        try {
            child.stdin.write('\n');
        } catch (e) {
            // ignore pipe errors
        }
    }
}, 500);

child.on('close', (code) => {
    clearInterval(interval);
    console.log(`drizzle-kit exited with code ${code}`);
    process.exit(code || 0);
});

child.on('error', (err) => {
    console.error('Failed to start subprocess.', err);
    clearInterval(interval);
    process.exit(1);
});
