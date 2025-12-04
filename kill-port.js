const { execSync } = require('child_process');

// Get port from command line argument, default to 5000
const port = process.argv[2] || 5000;

console.log('================================================');
console.log(`  Killing Process on Port ${port}`);
console.log('================================================');
console.log('');

try {
  if (process.platform === 'win32') {
    // Windows
    console.log(`Searching for process using port ${port}...`);
    console.log('');

    try {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });

      // Extract PID from netstat output
      const lines = output.trim().split('\n');
      const pidMatch = lines[0].match(/\s+(\d+)\s*$/);

      if (pidMatch) {
        const pid = pidMatch[1];
        console.log(`Found process with PID: ${pid}`);
        console.log('Attempting to kill process...');
        console.log('');

        execSync(`taskkill /F /PID ${pid}`, { stdio: 'inherit' });

        console.log('');
        console.log('✓ SUCCESS: Process killed successfully!');
        console.log(`Port ${port} is now available.`);
        console.log('');
      } else {
        console.log(`No process found using port ${port}`);
        console.log('');
      }
    } catch (error) {
      if (error.message.includes('not recognized')) {
        console.log(`No process found using port ${port}`);
        console.log('');
      } else {
        throw error;
      }
    }
  } else {
    // Unix/Linux/Mac
    console.log(`Searching for process using port ${port}...`);
    console.log('');

    try {
      const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8' }).trim();

      if (pid) {
        console.log(`Found process with PID: ${pid}`);
        console.log('Attempting to kill process...');
        console.log('');

        execSync(`kill -9 ${pid}`);

        console.log('');
        console.log('✓ SUCCESS: Process killed successfully!');
        console.log(`Port ${port} is now available.`);
        console.log('');
      } else {
        console.log(`No process found using port ${port}`);
        console.log('');
      }
    } catch (error) {
      if (error.status === 1) {
        console.log(`No process found using port ${port}`);
        console.log('');
      } else {
        throw error;
      }
    }
  }
} catch (error) {
  console.error('');
  console.error('✗ ERROR: Could not kill process.');
  console.error('You may need to run this script with elevated privileges.');
  console.error('');
  process.exit(1);
}
