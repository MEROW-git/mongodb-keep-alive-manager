const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { connectToDatabase } = require('./mongodb');
const { scheduledPingHandler } = require('../scheduled-ping');

let schedulerInterval = null;
let isPinging = false;

/**
 * Checks if the configured interval has elapsed since the last keep-alive ping.
 * If elapsed, executes scheduledPingHandler to ping all active databases and notify Telegram.
 */
async function checkAndTriggerScheduledPing() {
  if (isPinging) return;
  try {
    const { db } = await connectToDatabase();
    const settingsCol = db.collection('settings');
    const logsCol = db.collection('logs');

    const settings = await settingsCol.findOne({});
    if (settings && settings.enabled === false) {
      return; // Automation disabled by administrator
    }

    const intervalMinutes = (settings && typeof settings.interval === 'number' && settings.interval > 0)
      ? settings.interval
      : 5;
    const intervalMs = intervalMinutes * 60 * 1000;

    // Retrieve the most recent keep-alive ping timestamp
    const latestLog = await logsCol.findOne({}, { sort: { createdAt: -1 } });
    const now = Date.now();

    const lastPingTime = (latestLog && latestLog.createdAt)
      ? new Date(latestLog.createdAt).getTime()
      : 0;

    const elapsedMs = now - lastPingTime;

    if (elapsedMs >= intervalMs) {
      isPinging = true;
      console.log(`\n⏰ [AUTONOMOUS SCHEDULER] Interval reached (${intervalMinutes}m elapsed). Running keep-alive pings...`);
      try {
        await scheduledPingHandler({}, { clientContext: { custom: { scheduled: true } } });
      } finally {
        isPinging = false;
      }
    }
  } catch (err) {
    isPinging = false;
    const isSslAlert = err.message && (err.message.includes('SSL alert number 80') || err.message.includes('tlsv1 alert internal error'));
    if (isSslAlert) {
      console.error('❌ [AUTONOMOUS SCHEDULER] MongoDB connection rejected (SSL alert 80): Lightsail IP is not whitelisted in MongoDB Atlas Network Access. Add your Lightsail IP or 0.0.0.0/0 in MongoDB Atlas.');
    } else {
      console.error('❌ [AUTONOMOUS SCHEDULER] Error during scheduled check:', err.message);
    }
  }
}

/**
 * Starts the autonomous background scheduler in Node.js.
 * Runs independently of any open browser tabs or frontend client connections.
 */
function startAutonomousScheduler(checkFrequencyMs = 15000) {
  if (schedulerInterval) return;
  console.log('⏰ Autonomous 24/7 Database Keep-Alive Scheduler started (runs independently of browser tabs)');

  // Initial check 5 seconds after startup
  setTimeout(checkAndTriggerScheduledPing, 5000);

  // Poll every checkFrequencyMs (default 15 seconds) to check if interval has elapsed
  schedulerInterval = setInterval(checkAndTriggerScheduledPing, checkFrequencyMs);
}

function stopAutonomousScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏹️  Autonomous Database Keep-Alive Scheduler stopped.');
  }
}

module.exports = {
  checkAndTriggerScheduledPing,
  startAutonomousScheduler,
  stopAutonomousScheduler,
};
