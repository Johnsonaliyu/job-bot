/**
 * Google Sheets module — duplicate detection + application logging.
 *
 * Sheet columns: Date | Group | Email | Job Title | Company | CV Used | Status
 */
const { google } = require('googleapis');

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
}

const HEADERS   = ['Date', 'Group', 'Email', 'Job Title', 'Company', 'CV Used', 'Status'];
const TAB       = () => process.env.LOG_SHEET_TAB || 'Applications';
const SHEET_ID  = () => process.env.LOG_SHEET_ID;

async function ensureHeaders(sheets) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range:         `${TAB()}!A1:G1`
    });
    if (!res.data.values?.[0]?.includes('Date')) {
      await sheets.spreadsheets.values.update({
        spreadsheetId:   SHEET_ID(),
        range:           `${TAB()}!A1`,
        valueInputOption: 'RAW',
        requestBody:     { values: [HEADERS] }
      });
    }
  } catch {
    // New sheet — headers will be written on first append
  }
}

/**
 * Returns true if we have already applied to this email+jobTitle combination.
 */
async function isDuplicate(email, jobTitle) {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });

  let rows;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID(),
      range:         `${TAB()}!A:G`
    });
    rows = res.data.values || [];
  } catch (err) {
    console.error('Sheets read error (duplicate check):', err.message);
    return false; // Fail open — attempt the application
  }

  const emailLower = email.toLowerCase().trim();
  const titleLower = jobTitle.toLowerCase().trim();

  return rows.slice(1).some(row => {
    const rowEmail = (row[2] || '').toLowerCase().trim();
    const rowTitle = (row[3] || '').toLowerCase().trim();
    return rowEmail === emailLower && rowTitle === titleLower;
  });
}

/**
 * Appends a new row to the log sheet.
 */
async function logApplication({ group, email, jobTitle, company, cvUsed, status = 'Sent' }) {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() });
  await ensureHeaders(sheets);

  const row = [
    new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos' }),
    group || '',
    email,
    jobTitle,
    company || '',
    cvUsed,
    status
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId:   SHEET_ID(),
    range:           `${TAB()}!A:G`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody:     { values: [row] }
  });
}

module.exports = { isDuplicate, logApplication };
