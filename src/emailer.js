/**
 * Email module — sends a professional application email with the CV attached.
 */
const nodemailer = require('nodemailer');
const fs         = require('fs');

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '465', 10),
    secure: true,           // port 465 = SSL
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Sends an application email.
 * @param {object} opts
 * @param {string} opts.to          - Recipient email
 * @param {string} opts.jobTitle    - Job title
 * @param {string} opts.company     - Company name (may be null)
 * @param {string} opts.cvFilePath  - Absolute path to the downloaded CV
 * @param {string} opts.cvFileName  - Original file name (used as attachment name)
 * @param {string} opts.cvMimeType  - MIME type of the CV file
 */
async function sendApplication({ to, jobTitle, company, cvFilePath, cvFileName, cvMimeType }) {
  const transporter = createTransport();
  const fromName    = process.env.FROM_NAME || 'Aliu Johnson Temitope';
  const fromEmail   = process.env.SMTP_USER;

  const subject = company
    ? `Application for ${jobTitle} — ${company}`
    : `Application for ${jobTitle}`;

  const body = `Dear Hiring Manager,

I am writing to express my interest in the ${jobTitle} position${company ? ` at ${company}` : ''} as advertised.

Please find my CV attached for your consideration. I am confident that my skills and experience align well with the requirements of this role and I would welcome the opportunity to contribute to your team.

I am available for an interview at your convenience and look forward to hearing from you.

Thank you for your time and consideration.

Yours sincerely,
${fromName}
📧 ${fromEmail}`;

  await transporter.sendMail({
    from:        `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text:        body,
    attachments: [
      {
        filename:    cvFileName,
        path:        cvFilePath,
        contentType: cvMimeType
      }
    ]
  });

  console.log(`✉️  Email sent → ${to} | ${jobTitle}`);

  // Clean up the temp CV file after sending
  try { fs.unlinkSync(cvFilePath); } catch {}
}

module.exports = { sendApplication };
