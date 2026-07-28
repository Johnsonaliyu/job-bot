/**
 * Google Drive module — downloads the correct CV for a given job category.
 *
 * CV names in the Drive folder:
 *   tech  → file whose name contains "tech"
 *   sales → file whose name contains "sales"
 *   admin → file that contains "CV" but is neither tech nor sales
 */
const { google } = require('googleapis');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    },
    scopes: ['https://www.googleapis.com/auth/drive.readonly']
  });
}

/**
 * Returns { filePath, fileName, mimeType } for the requested CV type.
 * cvType: 'tech' | 'sales' | 'admin'
 */
async function downloadCV(cvType) {
  const auth  = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  const folderId = process.env.CV_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error('CV_DRIVE_FOLDER_ID secret is not set');

  const listRes = await drive.files.list({
    q:       `'${folderId}' in parents and trashed = false`,
    fields:  'files(id, name, mimeType)',
    orderBy: 'name'
  });

  const files = listRes.data.files || [];
  if (!files.length) throw new Error('No files found in CV Drive folder');

  // Pick the right file
  let target;
  const nameLower = (f) => (f.name || '').toLowerCase();

  if (cvType === 'tech') {
    target = files.find(f => nameLower(f).includes('tech'));
  } else if (cvType === 'sales') {
    target = files.find(f => nameLower(f).includes('sales'));
  } else {
    // admin: CV file that is NOT tech and NOT sales
    target = files.find(f =>
      nameLower(f).includes('cv') &&
      !nameLower(f).includes('tech') &&
      !nameLower(f).includes('sales')
    );
  }

  // Ultimate fallback — first file in folder
  if (!target) {
    console.warn(`⚠️  No specific CV found for "${cvType}"; using first file in folder`);
    target = files[0];
  }

  console.log(`📎 CV selected: ${target.name}  (category: ${cvType})`);

  // Stream-download to a temp file
  const tmpPath = path.join(os.tmpdir(), target.name);
  const fileRes = await drive.files.get(
    { fileId: target.id, alt: 'media' },
    { responseType: 'stream' }
  );

  await new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(tmpPath);
    fileRes.data.pipe(dest);
    dest.on('finish', resolve);
    dest.on('error', reject);
  });

  // Resolve MIME type from extension if needed
  const ext = path.extname(target.name).toLowerCase();
  let mimeType = target.mimeType || 'application/octet-stream';
  if (ext === '.pdf')  mimeType = 'application/pdf';
  if (ext === '.docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === '.doc')  mimeType = 'application/msword';

  return { filePath: tmpPath, fileName: target.name, mimeType };
}

module.exports = { downloadCV };
