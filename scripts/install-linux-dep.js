const { execSync } = require('child_process');
const os = require('os');

if (os.platform() === 'linux') {
    console.log('Installing @nx/nx-linux-x64-gnu for Linux...');
    try {
        execSync('npm install @nx/nx-linux-x64-gnu', { stdio: 'inherit' });
    } catch (error) {
        console.error('Failed to install @nx/nx-linux-x64-gnu:', error);
    }
}