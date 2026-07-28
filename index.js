require('dotenv').config();

// ── Keep-alive server for Replit/UptimeRobot ──────────────────────────────────
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Amòfin is online! ⚖️');
}).listen(process.env.PORT || 3000, () => {
  console.log(`🌐 Keep-alive server on port ${process.env.PORT || 3000}`);
});

// ── Validate required secrets ─────────────────────────────────────────────────
// At least one AI key must be present alongside the WhatsApp number
const required = ['WHATSAPP_NUMBER'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`❌ Missing required secrets:\n  ${missing.join('\n  ')}`);
  console.error('\n👉 Add them in Replit Secrets panel.\n');
  process.exit(1);
}

const hasAnyAiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GROQ_API_KEY ||
  process.env.NVIDIA_API_KEY;

if (!hasAnyAiKey) {
  console.error('❌ At least one AI key is required: GEMINI_API_KEY, GROQ_API_KEY, or NVIDIA_API_KEY');
  process.exit(1);
}

const { startBot } = require('./src/bot');

console.log('\n⚖️  Amòfin Constitutional Advisor starting...\n');
startBot().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
