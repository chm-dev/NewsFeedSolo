import cron from 'node-cron';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('📅 Starting scheduler');
console.log('🔄 Fetch will run every 2 hours');

// Run fetch immediately on startup
console.log('🚀 Running initial fetch...');
exec('node src/index.js', { cwd: projectRoot }, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error running fetch: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Fetch stderr: ${stderr}`);
  }
  console.log(`Initial fetch completed: ${stdout}`);
});

// Schedule fetch to run every 2 hours
cron.schedule('0 */2 * * *', () => {
  console.log('🔄 Running scheduled fetch...');
  exec('node src/index.js', { cwd: projectRoot }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error running fetch: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Fetch stderr: ${stderr}`);
    }
    console.log(`Scheduled fetch completed: ${stdout}`);
  });
});

console.log('⏱️ Scheduler is running...');