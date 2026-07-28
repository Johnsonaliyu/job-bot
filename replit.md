# Job Application Bot 🤖

A WhatsApp bot that silently monitors job-posting groups and automatically applies to relevant roles by sending the right CV to the recruiter's email.

## How it works

1. Bot joins one or more WhatsApp job groups
2. Every message is analysed by AI (Groq → Nvidia fallback) to detect job posts
3. If a job post is found with a recruiter email, the bot:
   - Picks the correct CV based on the job category
   - Downloads the CV from Google Drive
   - Sends a professional application email via Gmail
   - Logs the application to Google Sheets (prevents duplicate applications)
   - Sends you a WhatsApp DM confirming the application

The bot **never sends any message to a group** — it is a pure silent observer.

## CV selection logic

| Job category | CV used |
|---|---|
| Tech (developer, IT, data, engineer…) | `Aliu Johnson_tech_CV` |
| Sales / Marketing + sales-oriented grad trainee | `Aliu Johnson_CV_sales` |
| Admin / VA / EA / general grad trainee | `Aliu Johnson_CV` |

## Stack

- **WhatsApp:** `whatsapp-web.js` + system Chromium
- **AI:** Groq `llama-3.3-70b-versatile` → Nvidia `llama-3.1-70b-instruct`
- **CV storage:** Google Drive (service account)
- **Duplicate tracking:** Google Sheets (service account)
- **Email:** Gmail SMTP (nodemailer)

## First-time setup — pairing

1. Run the workflow (`node index.js`)
2. A QR code will appear in the console
3. On your phone: **WhatsApp → Linked Devices → Link a Device → Scan QR Code**
4. Once paired, the bot prints `✅ Job Application Bot connected` and stays silent in groups

Session credentials are saved in `./auth_info/` — you only need to pair once.

## Environment variables (set as Replit Secrets)

| Variable | Description |
|---|---|
| `BOT_PHONE_NUMBER` | Your WhatsApp number (no `+`) |
| `OWNER_NOTIFY_NUMBER` | Number to receive application notifications |
| `GROQ_API_KEY` | Groq API key (primary AI) |
| `NVIDIA_API_KEY` | Nvidia NIM API key (fallback AI) |
| `SMTP_PASS` | Gmail App Password |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email |
| `GOOGLE_PRIVATE_KEY` | Service account private key |
| `CV_DRIVE_FOLDER_ID` | Google Drive folder ID containing your CVs |
| `LOG_SHEET_ID` | Google Sheets spreadsheet ID for the application log |

Non-secret vars (GROQ_MODEL, SMTP_HOST, etc.) are stored as plain env vars.

## User preferences
<!-- Add user preferences here -->
