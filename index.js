require('dotenv').config();
const { startBot } = require('./src/bot');

console.log('🤖 Job Application Bot starting...');
console.log('📋 Silently monitors job groups and auto-applies on your behalf.\n');

startBot().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
