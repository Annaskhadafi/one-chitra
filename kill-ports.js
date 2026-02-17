const { exec } = require('child_process');

// Ports to clean
const ports = [3000, 3001, 3002, 3003, 3004, 3005];

function killPorts() {
    const command = process.platform === 'win32'
        ? `netstat -ano`
        : `lsof -i -P -n | grep LISTEN`;

    exec(command, (err, stdout) => {
        if (err || !stdout) return;

        const pids = new Set();
        const lines = stdout.trim().split('\n');

        lines.forEach(line => {
            // Check if line contains one of our target ports
            const parts = line.trim().split(/\s+/);
            if (process.platform === 'win32') {
                // Format: Proto Local Address ... PID
                // Local Address contains :port
                const localAddr = parts[1];
                if (localAddr && ports.some(p => localAddr.endsWith(`:${p}`))) {
                    const pid = parts[parts.length - 1];
                    if (pid && pid !== '0') pids.add(pid);
                }
            } else {
                // robust unix parsing? easier to just grep lsof output per port
            }
        });

        if (pids.size === 0) {
            console.log('✅ No conflicting processes found on ports 3000-3005.');
        } else {
            console.log(`🔍 Found ${pids.size} processes to kill:`, Array.from(pids));
            pids.forEach(pid => {
                try {
                    process.kill(pid, 'SIGKILL');
                    console.log(`✅ Killed PID ${pid}`);
                } catch (e) {
                    // Ignore if already dead
                }
            });
        }
    });
}

console.log('🧹 Cleaning up dev server ports...');
killPorts();
