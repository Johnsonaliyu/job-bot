/**
 * WhatsApp bot — pure observer mode.
 *
 * The bot NEVER sends any message to a group.
 * It silently scans all group messages for job postings, auto-applies,
 * and notifies the owner via a private WhatsApp DM.
 */
const { Client, LocalAuth } = require('whatsapp-web.js');
const { execSync } = require('child_process');
const fs = require('fs');

// Resolve Chromium path across environments (Replit, Railway, Ubuntu, etc.)
function findChromium() {
  // 1. Explicit env var override — set this on Railway/Deployzy if needed
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
    return process.env.CHROMIUM_PATH;
  }
  // 2. Common fixed paths
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium'
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // 3. PATH lookup
  for (const cmd of ['chromium', 'chromium-browser', 'google-chrome']) {
    try {
      const p = execSync(`which ${cmd}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      if (p && fs.existsSync(p)) return p;
    } catch {}
  }
  // 4. No system Chromium found — let puppeteer use its bundled binary
  return undefined;
}

const { analyzeMessage }  = require('./ai');
const { downloadCV }      = require('./drive');
const { isDuplicate, logApplication } = require('./sheets');
const { sendApplication } = require('./emailer');

// Human-readable CV label for notifications / sheet logging
const CV_LABELS = {
  tech:  'Aliu Johnson_tech_CV',
  sales: 'Aliu Johnson_CV_sales',
  admin: 'Aliu Johnson_CV'
};

// Minimum message length — very short texts can't be job posts
const MIN_TEXT_LENGTH = 30;

// ── Owner DM notification ─────────────────────────────────────────────────────
async function notifyOwner(client, text) {
  const number = process.env.OWNER_NOTIFY_NUMBER;
  if (!number) return;
  try {
    await client.sendMessage(`${number}@c.us`, text);
  } catch (err) {
    console.error('Owner notify failed:', err.message);
  }
}

// ── Core job-processing pipeline ─────────────────────────────────────────────
async function processMessage(client, msg, text, groupName) {
  // 1. Ask AI whether this is a job post
  let analysis;
  try {
    analysis = await analyzeMessage(text);
  } catch (err) {
    console.error('AI analysis error:', err.message);
    return;
  }

  if (!analysis.isJobPosting) return;

  const { email, jobTitle, company, jobCategory, summary } = analysis;
  console.log(`📋 Job: "${jobTitle}" @ ${company || 'unknown'} | cat: ${jobCategory}`);

  // 2. No email → notify owner, skip auto-apply
  if (!email) {
    console.log('⚠️  No recruiter email found — skipping auto-apply');
    await notifyOwner(
      client,
      `⚠️ *Job post spotted — no email found*\n\n` +
      `*Role:* ${jobTitle}${company ? `\n*Company:* ${company}` : ''}\n` +
      `${summary ? `*Summary:* ${summary}\n` : ''}` +
      `*Group:* ${groupName}`
    );
    return;
  }

  // 3. Duplicate check
  let alreadyApplied = false;
  try {
    alreadyApplied = await isDuplicate(email, jobTitle);
  } catch (err) {
    console.error('Duplicate check error:', err.message);
  }
  if (alreadyApplied) {
    console.log(`⏭️  Duplicate skipped: ${email} — ${jobTitle}`);
    return;
  }

  // 4. Choose CV type; fall back to "admin" for "other" category
  const cvType = ['tech', 'sales', 'admin'].includes(jobCategory) ? jobCategory : 'admin';

  // 5. Download CV from Google Drive
  let cv;
  try {
    cv = await downloadCV(cvType);
  } catch (err) {
    console.error('CV download error:', err.message);
    await notifyOwner(client, `❌ CV download failed for *${jobTitle}*:\n${err.message}`);
    return;
  }

  // 6. Send the application email
  try {
    await sendApplication({
      to:         email,
      jobTitle,
      company,
      cvFilePath:  cv.filePath,
      cvFileName:  cv.fileName,
      cvMimeType:  cv.mimeType
    });
  } catch (err) {
    console.error('Email send error:', err.message);
    await notifyOwner(client, `❌ Email failed for *${jobTitle}* → ${email}:\n${err.message}`);
    return;
  }

  // 7. Log to Google Sheets
  try {
    await logApplication({
      group:   groupName,
      email,
      jobTitle,
      company: company || '',
      cvUsed:  CV_LABELS[cvType] || cv.fileName
    });
  } catch (err) {
    console.error('Sheets log error (non-fatal):', err.message);
  }

  // 8. Notify owner of success
  await notifyOwner(
    client,
    `✅ *Application sent!*\n\n` +
    `*Role:* ${jobTitle}${company ? `\n*Company:* ${company}` : ''}\n` +
    `*Email:* ${email}\n` +
    `*CV:* ${CV_LABELS[cvType]}\n` +
    `*Group:* ${groupName}`
  );

  console.log(`✅ Applied → ${email} (${jobTitle})`);
}

// Remove Chromium profile lock files left by a previous run on another machine
function clearProfileLocks(authDir) {
  const locks = [
    'SingletonLock',
    'SingletonSocket',
    'SingletonCookie'
  ];
  const sessionDir = require('path').join(authDir, 'session');
  for (const lock of locks) {
    const lockPath = require('path').join(sessionDir, lock);
    try {
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        console.log(`🔓 Removed lock file: ${lock}`);
      }
    } catch (err) {
      console.warn(`Could not remove ${lock}: ${err.message}`);
    }
  }
}

// ── Bot startup ───────────────────────────────────────────────────────────────
async function startBot() {
  const authDir = process.env.AUTH_FOLDER || './auth_info';
  clearProfileLocks(authDir);

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: authDir }),
    puppeteer: {
      ...(findChromium() ? { executablePath: findChromium() } : {}),
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    }
  });

  // ── Pairing code (requested only once) ───────────────────────────────────────
  let pairingRequested = false;
  client.on('qr', async () => {
    if (pairingRequested) return;   // ignore subsequent qr refreshes
    pairingRequested = true;

    const number = (process.env.BOT_PHONE_NUMBER || '').replace(/\D/g, '');
    if (!number) {
      console.log('❌ BOT_PHONE_NUMBER is not set — cannot request pairing code');
      return;
    }
    try {
      const code = await client.requestPairingCode(number);
      console.log('\n══════════════════════════════════════════════════');
      console.log(`  PAIRING CODE: ${code}`);
      console.log('══════════════════════════════════════════════════');
      console.log('Enter this in WhatsApp → Linked Devices → Link a Device → Link with phone number');
      console.log('(Code is valid for ~60 seconds)\n');
    } catch (err) {
      console.error('Pairing code error:', err.message);
    }
  });

  // ── Ready ────────────────────────────────────────────────────────────────────
  client.on('ready', () => {
    console.log('\n✅ Job Application Bot connected — observing groups silently.\n');
  });

  // ── Auth failure ─────────────────────────────────────────────────────────────
  client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
  });

  // ── Disconnected ─────────────────────────────────────────────────────────────
  client.on('disconnected', (reason) => {
    console.log(`⚠️  Disconnected: ${reason}. Restarting in 10s…`);
    setTimeout(() => startBot(), 10000);
  });

  // ── Message observer ─────────────────────────────────────────────────────────
  client.on('message', async (msg) => {
    // Only process group messages
    if (!msg.from.endsWith('@g.us')) return;

    // Skip very short texts
    const text = msg.body || '';
    if (text.trim().length < MIN_TEXT_LENGTH) return;

    // Resolve group name (best-effort)
    let groupName = msg.from;
    try {
      const chat = await msg.getChat();
      groupName  = chat.name || msg.from;
    } catch {}

    // Fire-and-forget with error capture
    processMessage(client, msg, text.trim(), groupName).catch(err => {
      console.error(`Error in processMessage [${groupName}]:`, err.message);
      notifyOwner(client, `❌ Error in *${groupName}*:\n${err.message}`).catch(() => {});
    });
  });

  await client.initialize();
}

module.exports = { startBot };
