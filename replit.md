# Amòfin ⚖️ — Olaoluwa Age Group Constitutional Advisor WhatsApp Bot

A WhatsApp bot that answers constitutional questions for the Olaoluwa Age Group, greets members in Yoruba, and handles announcements/reminders.

## Stack
- **Runtime:** Node.js ≥ 18
- **WhatsApp:** `@whiskeysockets/baileys`
- **AI:** Google Gemini (primary) → Groq → Nvidia NIM (fallbacks)
- **Scheduling:** `node-cron`

## How to run
```bash
npm install
npm start
```

On first run, a pairing code is printed to the console. Enter it in WhatsApp → Linked Devices → Link with phone number.

## Required environment variables
| Variable | Description |
|---|---|
| `WHATSAPP_NUMBER` | Bot's WhatsApp number in international format (no `+`), e.g. `2348012345678` |
| `GEMINI_API_KEY` | Google Gemini API key (primary AI) |
| `GROQ_API_KEY` | Groq API key (fallback 1) |
| `NVIDIA_API_KEY` | Nvidia NIM API key (fallback 2) |

At least one AI key is required. See `.env.example` for all optional variables.

## User preferences
<!-- Add user preferences here -->
